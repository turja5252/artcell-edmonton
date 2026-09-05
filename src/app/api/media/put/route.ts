import { mediaPutErrorResponse, putMediaFromRequest } from "@/lib/media-server-put";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    return await putMediaFromRequest(request);
  } catch (error) {
    return mediaPutErrorResponse(error);
  }
}
