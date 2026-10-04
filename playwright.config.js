// Configuración de las pruebas automáticas (Playwright).
// - Los tests nunca hablan con la base real: tests/support/app.js intercepta todo lo que va
//   a Supabase y responde con datos ficticios. Si algo se escapa sin mock, el test falla.
// - Zona horaria de Montevideo y locale es-UY, como en los teléfonos de Paulina y Delfina.
const { defineConfig, devices } = require('@playwright/test');

const PUERTO = Number(process.env.PUERTO_TESTS || 4173);

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    timezoneId: 'America/Montevideo',
    locale: 'es-UY',
    // sw.js no intercepta pedidos (no tiene listener de fetch), así que dejarlo registrar no
    // afecta las simulaciones. Hace falta: Notificaciones espera a navigator.serviceWorker.ready.
    serviceWorkers: 'allow',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: 'node tests/support/servidor.js',
    url: `http://localhost:${PUERTO}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
