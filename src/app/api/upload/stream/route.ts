// src/app/api/upload/stream/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, appendFile, stat, rename, unlink, mkdir } from 'fs/promises';
import path from 'path';

const DB_BASE_PATH = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'database');
const UPLOAD_TEMP_DIR = path.join(DB_BASE_PATH, 'uploads', 'tmp');

async function ensureDirectoryExists(directoryPath: string) {
    try {
        await stat(directoryPath);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            await mkdir(directoryPath, { recursive: true });
        } else {
            throw error;
        }
    }
}

export async function POST(req: NextRequest) {
    try {
        await ensureDirectoryExists(UPLOAD_TEMP_DIR);

        const formData = await req.formData();
        const chunk = formData.get('chunk') as Blob | null;
        const chunkIndex = formData.get('chunkIndex') as string | null;
        const totalChunks = formData.get('totalChunks') as string | null;
        const originalFilename = formData.get('originalFilename') as string | null;
        const uploadId = formData.get('uploadId') as string | null;

        if (!chunk || chunkIndex === null || totalChunks === null || !originalFilename || !uploadId) {
            return NextResponse.json({ message: 'Missing required chunking data.' }, { status: 400 });
        }
        
        // Sanitize uploadId to prevent directory traversal
        const safeUploadId = path.basename(uploadId);
        if (safeUploadId !== uploadId) {
            return NextResponse.json({ message: 'Invalid upload ID.' }, { status: 400 });
        }

        const tempFilePath = path.join(UPLOAD_TEMP_DIR, safeUploadId);
        const buffer = Buffer.from(await chunk.arrayBuffer());

        // For the first chunk, create the file. For subsequent chunks, append.
        if (chunkIndex === '0') {
            await writeFile(tempFilePath, buffer);
        } else {
            await appendFile(tempFilePath, buffer);
        }

        const isLastChunk = parseInt(chunkIndex, 10) === parseInt(totalChunks, 10) - 1;

        if (isLastChunk) {
            // The final step of moving the file to the correct project directory
            // will be handled by the client making a final call to a different endpoint,
            // so for now, we just confirm the last chunk is received.
            console.log(`[API/StreamUpload] Last chunk received for ${safeUploadId}. File is assembled in temp directory.`);
            return NextResponse.json({ 
                message: 'All chunks received. File assembled.',
                tempPath: safeUploadId,
                originalFilename: originalFilename
            });
        }

        return NextResponse.json({ message: `Chunk ${chunkIndex} received.` });

    } catch (error) {
        console.error('[API/StreamUpload] Error handling chunk:', error);
        return NextResponse.json({ message: 'Error processing file chunk.' }, { status: 500 });
    }
}
