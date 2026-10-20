import { createApiClient } from './api-client';
import { captureTokenFromLocation, getToken } from './auth-token';

// Se inicializa una sola vez al cargar la app: el token del fragmento se captura antes de
// la primera petición.
captureTokenFromLocation();

export const api = createApiClient({ getToken });
