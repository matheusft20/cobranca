import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MP_API_BASE = "https://api.mercadopago.com";

// MP webhook topic types
type WebhookTopic = "payment" | "merchant_order" | "preapproval";

interface WebhookNotification {
  id: string;
  live_mode: boolean;
  type: string;
  topic: string;
  date_created: string;
  application_id: number;
  user_id: number;
  version: string;
  api_version: string;
  action: string;
  data: {
    id: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Handle both POST (webhook) and GET (redirect back_urls)
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Handle GET requests from back_urls (redirect from MP payment page)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "unknown";
    const externalReference = url.searchParams.get("external_reference");

    // Return a simple HTML page for the redirect
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Pagamento</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: #f5f7fb;
            }
            .container {
              text-align: center;
              padding: 40px;
              background: white;
              border-radius: 20px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.1);
              max-width: 400px;
            }
            .icon { font-size: 64px; margin-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; color: #111827; margin-bottom: 12px; }
            .message { font-size: 14px; color: #6B7280; margin-bottom: 24px; }
            .redirect-box {
              padding: 16px;
              background: #F3F4F6;
              border-radius: 12px;
              font-size: 13px;
              color: #374151;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">${status === "approved" ? "✅" : status === "pending" ? "⏳" : "❌"}</div>
            <div class="title">${
              status === "approved" ? "Pagamento aprovado!" :
              status === "pending" ? "Pagamento pendente" :
              "Pagamento não aprovado"
            }</div>
            <div class="message">
              ${
                status === "approved" ? "O pagamento foi confirmado com sucesso." :
                status === "pending" ? "O pagamento está sendo processado." :
                "O pagamento não foi concluído. Tente novamente."
              }
            </div>
            <div class="redirect-box">
              Você pode fechar esta página e voltar ao aplicativo.
            </div>
          </div>
        </body>
      </html>
    `;

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse webhook notification
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body, null, 2));

    // Validate it's a valid MP notification
    const notification: WebhookNotification = body;

    if (!notification.topic && !notification.type) {
      console.log("Invalid webhook: missing topic/type");
      return new Response(
        JSON.stringify({ error: "Invalid notification format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle payment notifications
    const topic = (notification.topic || notification.type) as WebhookTopic;

    if (topic === "payment" || notification.type === "payment") {
      const paymentId = notification.data?.id || body.data?.id;

      if (!paymentId) {
        console.log("Missing payment ID in notification");
        return new Response(
          JSON.stringify({ error: "Missing payment ID" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Processing payment notification for payment_id: ${paymentId}`);

      // Get payment details from MP API
      // We need to get the user's access token from the transaction
      // First, find the transaction by external_reference or payment_id

      const mpStatus = body.status;
      const mpPaymentId = body.payment_id || paymentId;

      // Try to find transaction by external reference if provided
      const externalReference = body.external_reference;

      // Update transaction status based on MP notification
      // MP sends these statuses: pending, approved, authorized, in_process, in_mediation, rejected, cancelled, refunded, charged_back

      const statusMap: Record<string, string> = {
        "approved": "paid",
        "authorized": "paid",
        "pending": "pending",
        "in_process": "pending",
        "in_mediation": "pending",
        "rejected": "failed",
        "cancelled": "cancelled",
        "refunded": "refunded",
        "charged_back": "refunded",
      };

      const mpStatusValue = mpStatus || body.status || "pending";
      const newStatus = statusMap[mpStatusValue] || "pending";

      // Create a generic access token using the payment_id search
      // We need to find the user who owns this transaction

      // First, try to update by external_reference (preference ID)
      let updateResult;

      if (externalReference) {
        // external_reference contains the preference ID
        const { data: tx } = await supabase
          .from("transactions")
          .select("id, user_id")
          .eq("external_reference", externalReference)
          .maybeSingle();

        if (tx) {
          // Get the user's MP access token to verify the payment
          const { data: profile } = await supabase
            .from("profiles")
            .select("mp_access_token")
            .eq("id", tx.user_id)
            .maybeSingle();

          if (profile?.mp_access_token) {
            // Verify payment with MP API
            const mpResponse = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
              headers: {
                "Authorization": `Bearer ${profile.mp_access_token}`,
              },
            });

            if (mpResponse.ok) {
              const paymentData = await mpResponse.json();
              console.log("Payment data from MP:", JSON.stringify(paymentData, null, 2));

              // Update transaction with payment details
              const { error } = await supabase
                .from("transactions")
                .update({
                  payment_id: parseInt(paymentId),
                  mp_status: paymentData.status,
                  status: statusMap[paymentData.status] || "pending",
                  paid_at: paymentData.status === "approved" ? new Date().toISOString() : null,
                })
                .eq("id", tx.id);

              if (error) {
                console.error("Failed to update transaction:", error);
              } else {
                console.log(`Transaction ${tx.id} updated to ${paymentData.status}`);
              }
            }
          }
        }
      } else if (typeof paymentId === "string" || !isNaN(Number(paymentId))) {
        // Try to find by payment_id if we have one
        const { data: tx } = await supabase
          .from("transactions")
          .select("id")
          .eq("payment_id", parseInt(paymentId))
          .maybeSingle();

        if (tx) {
          const { error } = await supabase
            .from("transactions")
            .update({
              mp_status: mpStatusValue,
              status: newStatus,
              paid_at: newStatus === "paid" ? new Date().toISOString() : null,
            })
            .eq("id", tx.id);

          if (!error) {
            console.log(`Transaction ${tx.id} updated via payment_id to ${newStatus}`);
          }
        }
      }

      return new Response(
        JSON.stringify({ received: true, processed: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle other notification types
    if (topic === "merchant_order") {
      console.log("Merchant order notification received");
      // Merchant order notifications contain order info including payments
      return new Response(
        JSON.stringify({ received: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Unknown notification type - acknowledge but don't process
    console.log(`Unknown notification type: ${topic}`);
    return new Response(
      JSON.stringify({ received: true, processed: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
