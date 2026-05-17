import { ScannerUseCase } from "../useCases/ScannerUseCase";
import { BinarySearchUseCase } from "../useCases/BinarySearchUseCase";

/**
 * Analysis Worker - Offloads heavy binary processing from the main thread.
 */
self.onmessage = (event: MessageEvent) => {
  const { type, payload, id } = event.data;

  try {
    let result;
    switch (type) {
      case 'SCAN':
        result = ScannerUseCase.execute(payload.data);
        break;
      case 'BINARY_SEARCH':
        result = BinarySearchUseCase.execute(payload.data, payload.query);
        break;
      case 'EXTRACT_STRINGS':
        result = ScannerUseCase.extractStrings(payload.data);
        break;
      case 'SCAN_ASSETS':
        result = ScannerUseCase.scanAssets(payload.data);
        break;
      default:
        throw new Error(`Unknown analysis type: ${type}`);
    }

    self.postMessage({ id, type: 'SUCCESS', result });
  } catch (error) {
    self.postMessage({ id, type: 'ERROR', error: (error as Error).message });
  }
};
