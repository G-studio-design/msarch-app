// src/app/api/users/[userId]/avatar/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { stat, mkdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import mime from 'mime';
import { updateUserProfilePicture, findUserById } from '@/services/user-service';

// Correctly define the UPLOAD_DIR based on the environment variable from docker-compose.yml
const UPLOAD_DIR = join(process.env.DATABASE_PATH || join(process.cwd(), 'database'), 'uploads', 'avatars');


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

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userId = params.userId;
  if (!userId) {
    return new NextResponse('User ID is required', { status: 400 });
  }

  try {
    const user = await findUserById(userId);
    if (!user || !user.profilePictureUrl) {
      return new NextResponse('Avatar not found', { status: 404 });
    }

    // The profilePictureUrl now only stores the filename
    const filename = user.profilePictureUrl;
    // Construct the absolute path to the file on the server's filesystem inside the container
    const filePath = join(UPLOAD_DIR, filename);

    const fileBuffer = await readFile(filePath);
    
    // Determine content type from filename
    const contentType = mime.getType(filePath) || 'application/octet-stream';

    // Create headers to serve the image and prevent caching
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');

    return new NextResponse(fileBuffer, { status: 200, headers });

  } catch (error: any) {
    if (error.code === 'ENOENT') {
        // This is a common case if the file was deleted or never existed.
        return new NextResponse('Avatar file not found on disk', { status: 404 });
    }
    console.error(`[API/Avatar GET] Error for user ${userId}:`, error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userId = params.userId;
  if (!userId) {
    return NextResponse.json({ message: 'User ID is required.' }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('avatar') as File | null;

    if (!file) {
      return NextResponse.json({ message: 'No avatar file provided.' }, { status: 400 });
    }

    await ensureDirectoryExists(UPLOAD_DIR);
    
    const buffer = Buffer.from(await file.arrayBuffer());
    
    const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1E9)}`;
    const fileExtension = mime.getExtension(file.type) || 'jpg';
    const filename = `${userId}_${uniqueSuffix}.${fileExtension}`;
    
    // The service now only needs the filename
    const updatedUser = await updateUserProfilePicture(userId, filename);

    const absolutePath = join(UPLOAD_DIR, filename);
    await writeFile(absolutePath, buffer);

    return NextResponse.json({
      message: 'Profile picture updated successfully.',
      user: updatedUser,
    });

  } catch (error: any) {
    console.error(`[API/AvatarUpload POST] Error for user ${userId}:`, error);
    return NextResponse.json({ message: error.message || 'Failed to upload avatar.' }, { status: 500 });
  }
}
