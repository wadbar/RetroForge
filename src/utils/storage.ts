import { logger } from '../services/loggerService';

export const secureWipe = () => {
  let count = 0;
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('RF_')) {
      localStorage.removeItem(key);
      count++;
    }
  });
  logger.info(`Auditoria de Segurança: ${count} chaves de localStorage do RetroForge foram permanentemente apagadas no encerramento da sessão.`);
};

export const startStorageAudit = () => {
  setInterval(() => {
    let emptyCount = 0;
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('RF_')) {
        const val = localStorage.getItem(key);
        if (!val || val.trim() === '' || val === '[]' || val === '{}') {
          emptyCount++;
        }
      }
    });
    if (emptyCount > 0) {
      logger.warn(`[AuditService] Identificadas ${emptyCount} chaves sensíveis vazias ou expiradas no localStorage.`);
    }
  }, 60000 * 5); // A cada 5 minutos
};
