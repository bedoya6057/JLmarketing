import { supabase } from "@/integrations/supabase/client";

const REGION = "us-east-2";
const BUCKET_NAME = "encartes-jlmarketing-fotos2026";

export const uploadPhotoToS3 = async (
    fileData: string | File | Blob,
    fileName: string
): Promise<string | null> => {
    try {
        let base64: string;
        let contentType = "image/jpeg";

        if (typeof fileData === "string") {
            // Already a data URI or base64 string — pass directly
            base64 = fileData;
            const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,/);
            if (matches) {
                contentType = matches[1];
            }
        } else if (fileData instanceof Blob || fileData instanceof File) {
            // Convert Blob/File to base64
            contentType = fileData.type || "image/jpeg";
            const arrayBuffer = await fileData.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            let binary = "";
            for (let i = 0; i < uint8Array.byteLength; i++) {
                binary += String.fromCharCode(uint8Array[i]);
            }
            base64 = `data:${contentType};base64,${btoa(binary)}`;
        } else {
            throw new Error("Unsupported fileData type");
        }

        // Call the Supabase Edge Function instead of uploading directly to S3
        // This avoids CORS and CapacitorHttp signature issues on Android
        const { data, error } = await supabase.functions.invoke("upload-photo-s3", {
            body: { base64, fileName, contentType },
        });

        if (error) {
            console.error("Error calling upload-photo-s3 function:", error);
            throw new Error(`Error S3: ${error.message || error}`);
        }

        if (!data?.success) {
            throw new Error(`Error S3: ${data?.error || "Upload failed"}`);
        }

        return data.url ?? `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${fileName}`;
    } catch (error: any) {
        console.error("Error uploading photo to AWS S3:", error);
        throw new Error(`Error S3: ${error.message || error}`);
    }
};
