import { createStore } from './core/state.js';
import { createRouter } from './core/router.js';
import { renderLanding } from './ui/views/landing.js';
import { renderConfigure } from './ui/views/configure.js';
import { renderEmbed } from './ui/views/embed.js';
import { renderExport, handleOAuthCallback } from './ui/views/export.js';
import { renderVisualize } from './ui/views/visualize.js';
import { createToaster } from './ui/components/notification.js';

const toaster = createToaster();
document.body.appendChild(toaster.el);

const store = createStore({
  step: 'landing',
  data: null,
  selectedColumn: null,
  projectorData: null,
  modelId: null,
  apiKey: '',
  dimensions: null,
  metaColumns: [],
  embeddings: null,
  configUrl: null,
});

const router = createRouter(store, document.getElementById('app'));

router.register('landing',   (el, state) => renderLanding(el, state, store));
router.register('configure', (el, state) => renderConfigure(el, state, store));
router.register('embed',     (el, state) => renderEmbed(el, state, store, toaster));
router.register('export',    (el, state) => renderExport(el, state, store, toaster));
router.register('visualize', (el, state) => renderVisualize(el, state, store));

router.start();

handleOAuthCallback(store);
