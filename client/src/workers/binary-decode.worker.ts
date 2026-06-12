import {
  curvesToGroupedRecord,
  decodeBinaryPlotDataCore,
} from '@/lib/utils/binary-decode-core';

interface DecodeWorkerRequest {
  id: number;
  buffer: ArrayBuffer;
}

interface BinaryCurveData {
  eventId: string;
  plotKey: string;
  xArray: Float32Array;
  yArray: Float32Array;
}

interface DecodeWorkerSuccessResponse {
  id: number;
  ok: true;
  plots: Record<string, BinaryCurveData[]>;
}

interface DecodeWorkerErrorResponse {
  id: number;
  ok: false;
  error: string;
}

type DecodeWorkerResponse = DecodeWorkerSuccessResponse | DecodeWorkerErrorResponse;

self.onmessage = (event: MessageEvent<DecodeWorkerRequest>) => {
  const { id, buffer } = event.data;

  try {
    const decoded = decodeBinaryPlotDataCore(buffer);
    const response: DecodeWorkerResponse = {
      id,
      ok: true,
      plots: curvesToGroupedRecord(decoded),
    };
    self.postMessage(response);
  } catch (error) {
    const response: DecodeWorkerResponse = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : 'Binary decode failed',
    };
    self.postMessage(response);
  }
};
