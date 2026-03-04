import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Ensure keys are safely fetched from Vite env
const REGION = "us-east-2";
const BUCKET_NAME = "encartes-jlmarketing-fotos2026";

export const uploadPhotoToS3 = async (
    fileData: string | File | Blob,
    fileName: string
): Promise<string | null> => {
    try {
        const s3Client = new S3Client({
            region: REGION,
            credentials: {
                accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID || process.env.VITE_AWS_ACCESS_KEY_ID || '',
                secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || process.env.VITE_AWS_SECRET_ACCESS_KEY || ''
            }
        });

        let bodyData: Uint8Array | Blob;
        let contentType = "image/jpeg";

        if (typeof fileData === "string") {
            const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

            if (matches && matches.length === 3) {
                contentType = matches[1];
                const b64Data = matches[2];
                const byteString = atob(b64Data);
                const arrayBuffer = new ArrayBuffer(byteString.length);
                const uint8Array = new Uint8Array(arrayBuffer);

                for (let i = 0; i < byteString.length; i++) {
                    uint8Array[i] = byteString.charCodeAt(i);
                }

                bodyData = uint8Array; // Pass raw Uint8Array instead of Blob to avoid getsReader error
            } else {
                // Fallback for valid non-data URLs
                const res = await fetch(fileData);
                const arrayBuffer = await res.arrayBuffer();
                bodyData = new Uint8Array(arrayBuffer);

                if (fileData.startsWith("data:image/png")) contentType = "image/png";
                if (fileData.startsWith("data:image/webp")) contentType = "image/webp";
            }
        } else if (fileData instanceof Blob) {
            const arrayBuffer = await fileData.arrayBuffer();
            bodyData = new Uint8Array(arrayBuffer);
            contentType = fileData.type || "image/jpeg";
        } else {
            bodyData = fileData as any;
        }

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: bodyData,
            ContentType: contentType,
            // ACL: 'public-read' // Only if bucket allows ACLs, usually bucket policy is better
        });

        await s3Client.send(command);

        return `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${fileName}`;
    } catch (error: any) {
        console.error("Error uploading photo to AWS S3:", error);
        throw new Error(`Error S3: ${error.message || error}`);
    }
};
