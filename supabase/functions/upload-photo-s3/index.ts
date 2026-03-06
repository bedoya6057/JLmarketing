import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.19";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

const REGION = "us-east-2";
const BUCKET_NAME = "encartes-jlmarketing-fotos2026";

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // Authenticate request with Supabase JWT
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: userData, error: userError } = await anonClient.auth.getUser();
        if (userError || !userData?.user) {
            console.error("Auth error:", userError?.message);
            return new Response(JSON.stringify({ error: "Invalid token" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Parse body: { base64: string, fileName: string, contentType?: string }
        const body = await req.json();
        const { base64, fileName, contentType = "image/jpeg" } = body;

        if (!base64 || !fileName) {
            return new Response(
                JSON.stringify({ error: "Missing base64 or fileName" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Decode base64 to bytes
        const b64Data = base64.includes(",") ? base64.split(",")[1] : base64;
        const binaryStr = atob(b64Data);
        const bodyBytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bodyBytes[i] = binaryStr.charCodeAt(i);
        }

        // Read AWS credentials from Supabase secrets
        const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
        const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");

        if (!accessKeyId || !secretAccessKey) {
            console.error("AWS credentials missing from Supabase secrets");
            return new Response(
                JSON.stringify({ error: "AWS credentials not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`Uploading ${fileName} (${bodyBytes.length} bytes) to S3...`);

        // Use aws4fetch - Deno-native AWS request signer
        const aws = new AwsClient({
            accessKeyId,
            secretAccessKey,
            region: REGION,
            service: "s3",
        });

        const s3Url = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${fileName}`;

        const s3Response = await aws.fetch(s3Url, {
            method: "PUT",
            headers: {
                "Content-Type": contentType,
            },
            body: bodyBytes,
        });

        if (!s3Response.ok) {
            const errText = await s3Response.text();
            console.error(`S3 upload failed: ${s3Response.status}`, errText);
            return new Response(
                JSON.stringify({ error: `S3 upload failed: ${s3Response.status} - ${errText}` }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`Successfully uploaded ${fileName} to ${s3Url}`);
        return new Response(JSON.stringify({ success: true, url: s3Url }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error("Unexpected error:", errorMsg);
        return new Response(JSON.stringify({ error: errorMsg }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
