import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface FcmAlertPayload {
  token?: string
  tokens?: string[]
  userId?: string
  trackingCode?: string
  appointmentId?: string
  title: string
  message: string
  type?: string
  data?: Record<string, string>
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const payload: FcmAlertPayload = await req.json()
    const { title, message, appointmentId, trackingCode, userId, type = "queue_alert" } = payload
    let targetTokens: string[] = payload.tokens || (payload.token ? [payload.token] : [])

    if (!title || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: title, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // If no explicit tokens provided, query Supabase fcm_tokens table using trackingCode, userId, or appointmentId
    if (targetTokens.length === 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey)
        const tokenSet = new Set<string>()

        // 1. Query by trackingCode
        if (trackingCode) {
          const { data: byCode } = await supabase
            .from("fcm_tokens")
            .select("token")
            .eq("tracking_code", trackingCode.trim())
          if (byCode) {
            for (const r of byCode) {
              if (r.token) tokenSet.add(r.token)
            }
          }
        }

        // 2. Query by userId
        if (userId) {
          const { data: byUser } = await supabase
            .from("fcm_tokens")
            .select("token")
            .eq("user_id", userId.trim())
          if (byUser) {
            for (const r of byUser) {
              if (r.token) tokenSet.add(r.token)
            }
          }
        }

        // 3. Query by appointmentId
        if (appointmentId && tokenSet.size === 0) {
          const { data: appt } = await supabase
            .from("appointments")
            .select("user_id, tracking_code_10_digit")
            .eq("id", appointmentId.trim())
            .maybeSingle()

          if (appt) {
            if (appt.tracking_code_10_digit) {
              const { data: byApptCode } = await supabase
                .from("fcm_tokens")
                .select("token")
                .eq("tracking_code", appt.tracking_code_10_digit.trim())
              if (byApptCode) {
                for (const r of byApptCode) {
                  if (r.token) tokenSet.add(r.token)
                }
              }
            }
            if (appt.user_id) {
              const { data: byApptUser } = await supabase
                .from("fcm_tokens")
                .select("token")
                .eq("user_id", appt.user_id.trim())
              if (byApptUser) {
                for (const r of byApptUser) {
                  if (r.token) tokenSet.add(r.token)
                }
              }
            }
          }
        }

        targetTokens = Array.from(tokenSet)
      }
    }

    if (targetTokens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sentCount: 0, message: "No registered FCM device tokens found for target" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const projectId = Deno.env.get("FIREBASE_PROJECT_ID") || "dactor-health"
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`

    const sendResults = []

    for (const token of targetTokens) {
      // High-priority Android FCM payload compliant with Firebase HTTP v1 API
      const fcmMessage = {
        message: {
          token,
          notification: {
            title: title.trim(),
            body: message.trim(),
          },
          data: {
            title: title.trim(),
            body: message.trim(),
            message: message.trim(),
            appointment_id: appointmentId || "",
            tracking_code: trackingCode || "",
            type,
            ...(payload.data || {}),
          },
          android: {
            priority: "high",
            notification: {
              channel_id: "dactor_medical_alerts",
              sound: "default",
              priority: "high",
              default_sound: true,
              default_vibrate_timings: true,
            },
          },
        },
      }

      const bearerToken = Deno.env.get("FIREBASE_ACCESS_TOKEN")
      if (bearerToken) {
        const res = await fetch(fcmEndpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${bearerToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(fcmMessage),
        })
        const resJson = await res.json()
        sendResults.push({ token, status: res.status, result: resJson })
      } else {
        sendResults.push({ token, simulated: true, payload: fcmMessage })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sentCount: targetTokens.length,
        results: sendResults,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
