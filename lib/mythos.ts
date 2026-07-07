/**
 * Adapter that runs @mythos/sdk's Express-style handlers (`requireLaunchToken`,
 * `handshakeRoute`) inside Next.js Route Handlers, which use a different
 * (Request) => Response signature. The SDK only reads `req.query.lt`, calls
 * `res.status().json()`, or calls `next()` on success — all of which we can
 * fake with a minimal shim, without needing Express installed at runtime.
 */
import { handshakeRoute, requireLaunchToken, type MythosSession } from "@mythos/sdk";

type ShimReq = { query: Record<string, string | undefined>; mythos?: MythosSession };
type ShimRes = {
  status: (code: number) => ShimRes;
  json: (body: unknown) => void;
};
type ExpressLikeHandler = (req: ShimReq, res: ShimRes, next: () => void) => void | Promise<void>;

interface HandlerResult {
  status: number;
  body: unknown;
}

function runExpressHandler(handler: ExpressLikeHandler, lt: string | null): Promise<HandlerResult> {
  return new Promise((resolve) => {
    let statusCode = 200;
    const req: ShimReq = { query: { lt: lt ?? undefined } };
    const res: ShimRes = {
      status(code) {
        statusCode = code;
        return res;
      },
      json(body) {
        resolve({ status: statusCode, body });
      },
    };
    void handler(req, res, () => {
      // requireLaunchToken() only reaches here on success — req.mythos is now populated.
      resolve({ status: 200, body: { ok: true, session: req.mythos } });
    });
  });
}

export async function verifyAndConsumeLaunchToken(lt: string | null): Promise<HandlerResult> {
  return runExpressHandler(requireLaunchToken() as ExpressLikeHandler, lt);
}

export async function runHandshake(lt: string | null): Promise<HandlerResult> {
  return runExpressHandler(handshakeRoute() as unknown as ExpressLikeHandler, lt);
}
