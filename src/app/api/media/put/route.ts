import { mediaPutErrorResponse, putMediaFromRequest } from "@/lib/media-server-put";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    return await putMediaFromRequest(request);
  } catch (error) {
    return mediaPutErrorResponse(error);
  }
}
