// Background worker for the clothing AI (see smartAi.ts). The page sends it a photo;
// it answers with where each piece of clothing is and what the main piece is.
import { classify, findPieces, roughCut, warmUp, type Classification, type PartsResult } from './smartAi';

export type WorkerRequest =
  | { id: number; type: 'warm' }
  | { id: number; type: 'analyse'; photo: Blob }
  | { id: number; type: 'classify'; photo: Blob };

export type WorkerResponse =
  | { id: number; ok: true; parts?: PartsResult | null; classification?: Classification | null }
  | { id: number; ok: false; error: string };

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void;
};

scope.onmessage = async (e) => {
  const req = e.data;
  try {
    if (req.type === 'warm') {
      await warmUp();
      scope.postMessage({ id: req.id, ok: true });
    } else if (req.type === 'analyse') {
      // Find the pieces, then recognise the main one from a rough cut-out.
      const parts = await findPieces(req.photo);
      const main = parts.pieces[0];
      const classification = main ? await classify(await roughCut(req.photo, main)) : null;
      scope.postMessage({ id: req.id, ok: true, parts, classification }, [
        parts.owner.buffer,
        ...parts.pieces.map((p) => p.mask.buffer),
      ]);
    } else {
      scope.postMessage({ id: req.id, ok: true, classification: await classify(req.photo) });
    }
  } catch (err) {
    scope.postMessage({ id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
