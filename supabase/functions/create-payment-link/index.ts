import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MP_API_BASE = "https://api.mercadopago.com";

interface CreatePaymentRequest {
  transaction_id: string;
  amount: number; // in cents
  description: string;
  client_name: string;
  payer_email?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the auth token from the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Verify the user's session
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: CreatePaymentRequest = await req.json();
    const { transaction_id, amount, description, client_name, payer_email } = body;

    if (!transaction_id || !amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's MP access token
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("mp_access_token, company_name")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.mp_access_token) {
      return new Response(
        JSON.stringify({ error: "Mercado Pago not configured. Please add your access token in settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = profile.mp_access_token;
    const companyName = profile.company_name || "Empresa";

    // Get the transaction to verify it belongs to the user
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("id, amount, client_name")
      .eq("id", transaction_id)
      .eq("user_id", user.id)
      .single();

    if (txError || !transaction) {
      return new Response(
        JSON.stringify({ error: "Transaction not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the webhook URL from environment or construct it
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${supabaseUrl}/functions/v1/mp-webhook`;

    // Create preference in Mercado Pago
    const preferenceData = {
      items: [
        {
          id: transaction_id,
          title: description || `Cobrança - ${client_name}`,
          description: description || `Cobrança para ${client_name}`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: amount / 100, // Convert cents to BRL
        },
      ],
      payer: {
        name: client_name,
        email: payer_email || undefined,
      },
      back_urls: {
        success: `${supabaseUrl}/functions/v1/mp-webhook/success`,
        failure: `${supabaseUrl}/functions/v1/mp-webhook/failure`,
        pending: `${supabaseUrl}/functions/v1/mp-webhook/pending`,
      },
      auto_return: "approved",
      external_reference: transaction_id,
      notification_url: webhookUrl,
      statement_descriptor: companyName.substring(0, 13).toUpperCase(),
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    };

    const mpResponse = await fetch(`${MP_API_BASE}/checkout/preferences`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preferenceData),
    });

    if (!mpResponse.ok) {
      const mpError = await mpResponse.text();
      console.error("MP API Error:", mpError);
      return new Response(
        JSON.stringify({ error: "Failed to create payment preference", details: mpError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const preference = await mpResponse.json();

    // Update transaction with external reference and payment URL
    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        external_reference: preference.id,
        payment_url: preference.init_point,
        mp_status: "pending",
      })
      .eq("id", transaction_id);

    if (updateError) {
      console.error("Failed to update transaction:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_url: preference.init_point,
        preference_id: preference.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error creating payment link:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
