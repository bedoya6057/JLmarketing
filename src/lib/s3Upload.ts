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
                accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID || '',
                secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || ''
            }
        });

        let blob: Blob;
        let contentType = "image/jpeg";

        if (typeof fileData === "string") {
            // Convert base64 back to Blob/Buffer for S3
            const res = await fetch(fileData);
            blob = await res.blob();

            if (fileData.startsWith("data:image/png")) contentType = "image/png";
            if (fileData.startsWith("data:image/webp")) contentType = "image/webp";
        } else {
            blob = fileData;
            contentType = fileData.type || "image/jpeg";
        }

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: blob as any,
            ContentType: contentType,
            // ACL: 'public-read' // Only if bucket allows ACLs, usually bucket policy is better
        });

        await s3Client.send(command);

        return `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${fileName}`;
    } catch (error) {
        console.error("Error uploading photo to AWS S3:", error);
        return null;
    }
};
