(function setupAppConfig(globalScope) {
    const ENVIRONMENTS = {
        dev: {
            apiHost: 'http://127.0.0.1:8000'
        },
        qa: {
            apiHost: 'https://appstest.mineco.gob.pe/plataformaCF/catastroback'
        },
        prod: {
            apiHost: 'https://apps9.mineco.gob.pe/plataformaCF/catastroback'
        }
    };

    const DEFAULT_ENV = 'dev';

    function resolveEnvironment() {
        const host = globalScope.location?.hostname || '';

        if (host.includes('localhost') || host === '127.0.0.1') {
            return 'dev';
        }

        if (host.includes('qa') || host.includes('staging')) {
            return 'qa';
        }

        if (host.includes('apps9.mineco.gob.pe')) {
            return 'prod';
        }

        return DEFAULT_ENV;
    }

    const appEnv = globalScope.APP_ENV || resolveEnvironment() || DEFAULT_ENV;
    const selected = ENVIRONMENTS[appEnv] || ENVIRONMENTS[DEFAULT_ENV];

    globalScope.APP_CONFIG = {
        env: appEnv,
        environments: ENVIRONMENTS,
        apiHost: selected.apiHost,
        buildApiUrl(path) {
            const normalizedPath = String(path || '').startsWith('/') ? String(path) : `/${String(path || '')}`;
            return `${this.apiHost}${normalizedPath}`;
        }
    };
}(window));
