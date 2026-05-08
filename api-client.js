(function setupBackendApi(globalScope) {
    let authToken = null;

    async function requestJson(url, options = {}) {
        const response = await fetch(url, options);

        let responseBody = null;
        const responseText = await response.text();
        if (responseText) {
            try {
                responseBody = JSON.parse(responseText);
            } catch (_) {
                responseBody = responseText;
            }
        }

        if (!response.ok) {
            const error = new Error(`Error HTTP ${response.status} al consumir ${url}`);
            error.status = response.status;
            error.body = responseBody;
            throw error;
        }

        return responseBody;
    }

    async function postJson(url, payload, extraHeaders = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...extraHeaders
        };

        return requestJson(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });
    }

    async function getJson(url, extraHeaders = {}) {
        return requestJson(url, {
            method: 'GET',
            headers: {
                ...extraHeaders
            }
        });
    }

    function setAuthToken(token) {
        authToken = token ? String(token) : null;
    }

    function getBearerHeader() {
        if (!authToken) {
            throw new Error('No hay token de autenticacion disponible.');
        }

        return {
            Authorization: `Bearer ${authToken}`
        };
    }

    async function exchangeTicket(ticket) {
        if (!ticket) {
            throw new Error('El parametro ticket es obligatorio.');
        }

        const apiHost = globalScope.APP_CONFIG?.apiHost;
        if (!apiHost) {
            throw new Error('No se encontro APP_CONFIG.apiHost.');
        }

        const endpoint = globalScope.APP_CONFIG.buildApiUrl('/external/exchange-ticket');
        const response = await postJson(endpoint, { ticket: String(ticket) });
        setAuthToken(response?.token || null);
        return response;
    }

    async function getRecorridosBySolicitud(idSolicitud) {
        if (!idSolicitud) {
            throw new Error('El parametro id_solicitud es obligatorio.');
        }

        const apiHost = globalScope.APP_CONFIG?.apiHost;
        if (!apiHost) {
            throw new Error('No se encontro APP_CONFIG.apiHost.');
        }

        const endpoint = globalScope.APP_CONFIG.buildApiUrl(`/api/v1/inspection-request/recorridos/listar/${encodeURIComponent(String(idSolicitud))}`);
        return getJson(endpoint, getBearerHeader());
    }

    globalScope.BackendApi = {
        exchangeTicket,
        getRecorridosBySolicitud,
        setAuthToken
    };
}(window));
