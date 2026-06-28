/*
HOW TO RUN
1) Open a terminal at the repo root.
2) Run: node tests/run-tests.mjs

*/

// ------------------------------------------------------------
// Minimal mock environment
// ------------------------------------------------------------
globalThis.window = {
    console: globalThis.console,
};

let currentUILang = 'en-US';
const storageData = new Map();
let mockTabs = [];
let mockDisplayedMessages = {};
let createdMenus = [];
let badgeTextCalls = [];
let menuClickHandlers = [];

globalThis.messenger = {
    i18n: {
        getUILanguage() {
            return currentUILang;
        }
    },
    tabs: {
        onCreated: {
            addListener() {
                // No-op for unit tests.
            }
        },
        async query() {
            return mockTabs;
        }
    },
    messageDisplay: {
        async getDisplayedMessages(tabId) {
            const result = mockDisplayedMessages[tabId];
            if (result instanceof Error) {
                throw result;
            }
            return result;
        }
    },
    messageDisplayAction: {
        async setBadgeText(obj) {
            badgeTextCalls.push(obj);
        }
    },
    menus: {
        async create(menu) {
            createdMenus.push(menu);
            return menu.id || `menu-${createdMenus.length}`;
        },
        async remove(menuId) {
            const index = createdMenus.findIndex(m => m.id === menuId);
            if (index !== -1) {
                createdMenus.splice(index, 1);
            }
        },
        onClicked: {
            addListener(handler) {
                menuClickHandlers.push(handler);
            },
            removeListener(handler) {
                menuClickHandlers = menuClickHandlers.filter((h) => h !== handler);
            },
            hasListener(handler) {
                return menuClickHandlers.includes(handler);
            }
        }
    },
    runtime: {
        openOptionsPage() {
            // No-op for unit tests.
        }
    },
    windows: {
        openDefaultBrowser() {
            // No-op for unit tests.
        }
    },
    storage: {
        local: {
            async get(key) {
                if (typeof key === 'string') {
                    return storageData.has(key) ? { [key]: storageData.get(key) } : {};
                }
                if (Array.isArray(key)) {
                    const res = {};
                    for (const k of key) {
                        if (storageData.has(k)) {
                            res[k] = storageData.get(k);
                        }
                    }
                    return res;
                }
                if (key === null || key === undefined) {
                    const res = {};
                    for (const [k, v] of storageData.entries()) {
                        res[k] = v;
                    }
                    return res;
                }
                // Fallback for unexpected calls.
                return {};
            },
            async set(obj) {
                for (const [k, v] of Object.entries(obj)) {
                    storageData.set(k, v);
                }
            },
            async remove(key) {
                storageData.delete(key);
            }
        }
    }
};

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function resetStorage() {
    storageData.clear();
}

function resetMessageDisplayMocks() {
    mockTabs = [];
    mockDisplayedMessages = {};
}

function resetMenuMocks() {
    createdMenus = [];
    badgeTextCalls = [];
    menuClickHandlers = [];
}

async function withNoopTimers(fn) {
    const originalSetInterval = globalThis.setInterval;
    const originalClearInterval = globalThis.clearInterval;
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    let timerId = 0;

    globalThis.setInterval = () => ++timerId;
    globalThis.clearInterval = () => {};
    globalThis.setTimeout = () => ++timerId;
    globalThis.clearTimeout = () => {};

    try {
        await fn();
    } finally {
        globalThis.setInterval = originalSetInterval;
        globalThis.clearInterval = originalClearInterval;
        globalThis.setTimeout = originalSetTimeout;
        globalThis.clearTimeout = originalClearTimeout;
    }
}

async function setSettings({ transSubjectPrefix, onlyOnePrefix, keepOriginalLanguage }) {
    const rwhSettings = await import('../modules/settings.mjs');
    if (typeof transSubjectPrefix !== 'undefined') {
        await rwhSettings.set('trans.subject.prefix', transSubjectPrefix);
    }
    if (typeof onlyOnePrefix !== 'undefined') {
        await rwhSettings.set('subject.prefix.only.one', onlyOnePrefix);
    }
    if (typeof keepOriginalLanguage !== 'undefined') {
        await rwhSettings.set('subject.prefix.keep.original.language', keepOriginalLanguage);
    }
}

async function createRwh() {
    const { ReplyWithHeader } = await import('../modules/compose.mjs');
    return new ReplyWithHeader('acc-1', { type: 'reply', relatedMessageId: 'msg-1', isPlainText: true }, { headers: {} });
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message || 'Assertion failed'}\nExpected: ${expected}\nActual: ${actual}`);
    }
}

function assertOk(value, message) {
    if (!value) {
        throw new Error(message || 'Assertion failed');
    }
}

// ------------------------------------------------------------
// Test runner
// ------------------------------------------------------------
let failures = 0;
async function test(name, fn) {
    try {
        await fn();
        console.log(`✓ ${name}`);
    } catch (err) {
        failures++;
        console.error(`✗ ${name}`);
        console.error(err);
    }
}

async function runAllTests() {
    await test('cleanSubjectPrefixes: null/undefined handling', async () => {
        resetStorage();
        await setSettings({ transSubjectPrefix: true, onlyOnePrefix: false, keepOriginalLanguage: true });
        const rwh = await createRwh();
        assertEqual(await rwh._cleanSubjectPrefixes(null), '', 'null should return empty string');
        assertEqual(await rwh._cleanSubjectPrefixes(undefined), '', 'undefined should return empty string');
    });

    await test('cleanSubjectPrefixes: non-string and whitespace handling', async () => {
        resetStorage();
        await setSettings({ transSubjectPrefix: true, onlyOnePrefix: false, keepOriginalLanguage: true });
        const rwh = await createRwh();
        assertEqual(await rwh._cleanSubjectPrefixes(123), '123', 'number should stringify');
        assertEqual(await rwh._cleanSubjectPrefixes('   '), '   ', 'whitespace-only should be preserved');
    });

    await test('cleanSubjectPrefixes: no known prefix returns original', async () => {
        resetStorage();
        await setSettings({ transSubjectPrefix: true, onlyOnePrefix: false, keepOriginalLanguage: true });
        const rwh = await createRwh();
        assertEqual(await rwh._cleanSubjectPrefixes('Topic: Hello'), 'Topic: Hello');
    });

    await test('cleanSubjectPrefixes: custom prefix + single RE', async () => {
        resetStorage();
        await setSettings({ transSubjectPrefix: true, onlyOnePrefix: false, keepOriginalLanguage: true });
        const rwh = await createRwh();
        assertEqual(await rwh._cleanSubjectPrefixes('Topic: RE: Test'), 'RE: Topic: Test');
    });

    await test('cleanSubjectPrefixes: custom prefix after leading RE', async () => {
        resetStorage();
        await setSettings({ transSubjectPrefix: true, onlyOnePrefix: false, keepOriginalLanguage: true });
        const rwh = await createRwh();
        const subject = 'RE: Topic: RE: AW: AW: Fwd: Test 2 ReplyWithHeader';
        assertEqual(await rwh._cleanSubjectPrefixes(subject), 'RE: FW: Topic: Test 2 ReplyWithHeader');
    });

    await test('cleanSubjectPrefixes: reduce by type and standardize', async () => {
        resetStorage();
        await setSettings({ transSubjectPrefix: true, onlyOnePrefix: false, keepOriginalLanguage: true });
        const rwh = await createRwh();
        const subject = 'FWD: RE: RE: FWD: Test Subject';
        assertEqual(await rwh._cleanSubjectPrefixes(subject), 'FW: RE: FW: Test Subject');
    });

    await test('cleanSubjectPrefixes: only one prefix', async () => {
        resetStorage();
        await setSettings({ transSubjectPrefix: true, onlyOnePrefix: true, keepOriginalLanguage: true });
        const rwh = await createRwh();
        assertEqual(await rwh._cleanSubjectPrefixes('FWD: RE: Test'), 'FW: Test');
    });

    await test('cleanSubjectPrefixes: transform all to user language', async () => {
        resetStorage();
        currentUILang = 'en-US';
        await setSettings({ transSubjectPrefix: true, onlyOnePrefix: false, keepOriginalLanguage: false });
        const rwh = await createRwh();
        assertEqual(await rwh._cleanSubjectPrefixes('AW: WG: Test'), 'RE: FW: Test');
    });

    await test('cleanSubjectPrefixes: keep original language (translate first to mailLang)', async () => {
        resetStorage();
        currentUILang = 'en-US';
        await setSettings({ transSubjectPrefix: true, onlyOnePrefix: false, keepOriginalLanguage: true });
        const rwh = await createRwh();
        assertEqual(await rwh._cleanSubjectPrefixes('FW: AW: WG: Test'), 'WG: AW: WG: Test');
    });

    await test('cleanSubjectPrefixes: boundary check for prefixes', async () => {
        resetStorage();
        await setSettings({ transSubjectPrefix: true, onlyOnePrefix: false, keepOriginalLanguage: true });
        const rwh = await createRwh();
        assertEqual(await rwh._cleanSubjectPrefixes('XRE: Test'), 'XRE: Test');
    });

    await test('helper methods: getPrefixLanguageAndType and translatePrefix', async () => {
        resetStorage();
        const rwh = await createRwh();
        const info = rwh._getPrefixLanguageAndType('AW');
        assertOk(info, 'AW should resolve');
        assertEqual(info.lang, 'de');
        assertEqual(info.type, 'reply');
        assertEqual(rwh._translatePrefix('AW', 'en-US', info.index), 'RE');
    });

    await test('utils: isObjectEmpty and toPartialCanonicalFormat', async () => {
        const rwhUtils = await import('../modules/utils.mjs');
        assertOk(rwhUtils.isObjectEmpty({}), 'empty object should be empty');
        assertOk(!rwhUtils.isObjectEmpty({ a: 1 }), 'non-empty object should not be empty');
        assertEqual(rwhUtils.toPartialCanonicalFormat('x-message-id'), 'X-Message-ID');
        assertEqual(rwhUtils.toPartialCanonicalFormat('dkim-signature'), 'DKIM-Signature');
    });

    await test('tabs.findTab: skips tabs that cannot provide displayed messages', async () => {
        resetMessageDisplayMocks();
        mockTabs = [{ id: 11 }, { id: 22 }, { id: 33 }];
        mockDisplayedMessages = {
            11: new Error('Not a message display tab'),
            22: { messages: [] },
            33: { messages: [{ id: 'target-msg' }] }
        };

        const rwhTabs = await import('../modules/tabs.mjs');
        const tab = await rwhTabs.findTab('target-msg');
        assertEqual(tab?.id, 33, 'should continue scanning and find matching tab');
    });

    await test('tabs.findTab: returns null when no displayed message matches', async () => {
        resetMessageDisplayMocks();
        mockTabs = [{ id: 100 }, { id: 200 }];
        mockDisplayedMessages = {
            100: { messages: [{ id: 'msg-a' }] },
            200: { messages: [] }
        };

        const rwhTabs = await import('../modules/tabs.mjs');
        const tab = await rwhTabs.findTab('missing-msg');
        assertEqual(tab, null, 'should return null if no tab has the message id');
    });

    await test('menus action: disable 10s safely no-ops when displayed message is empty', async () => {
        resetStorage();
        resetMenuMocks();
        resetMessageDisplayMocks();
        mockDisplayedMessages = {
            700: { messages: [] }
        };

        const rwhMenus = await import('../modules/menus.mjs');
        await withNoopTimers(async () => {
            await rwhMenus.register();
            const menu = createdMenus.find((m) => m.id === 'rwh_disable_10s');
            assertOk(menu, 'disable menu should exist');
            assertOk(menuClickHandlers.length > 0, 'onClicked listener should be registered');
            await menuClickHandlers[0]({ menuItemId: 'rwh_disable_10s' }, { id: 700 });
        });

        const all = await messenger.storage.local.get(null);
        const hasDisablePref = Object.keys(all).some((k) => k.startsWith('extensions.replywithheader.disable.message_'));
        assertOk(!hasDisablePref, 'disable pref should not be written when no message exists');
        assertEqual(badgeTextCalls.length, 0, 'badge should not update when no message exists');
    });

    await test('menus action: forward all headers writes scoped pref for valid displayed message', async () => {
        resetStorage();
        resetMenuMocks();
        resetMessageDisplayMocks();
        mockDisplayedMessages = {
            701: { messages: [{ id: 99, folder: { accountId: 'acc-7' } }] }
        };

        const rwhMenus = await import('../modules/menus.mjs');
        await withNoopTimers(async () => {
            await rwhMenus.register();
            const menu = createdMenus.find((m) => m.id === 'rwh_all_headers_10s');
            assertOk(menu, 'all-headers menu should exist');
            assertOk(menuClickHandlers.length > 0, 'onClicked listener should be registered');
            await menuClickHandlers[0]({ menuItemId: 'rwh_all_headers_10s' }, { id: 701 });
        });

        const pref = await messenger.storage.local.get('extensions.replywithheader.header.fwd.all.acc-7.message_99');
        assertEqual(pref['extensions.replywithheader.header.fwd.all.acc-7.message_99'], true, 'forward all headers pref should be written');
        assertEqual(badgeTextCalls[0]?.text, '10s', 'badge should initialize to 10s');
    });

    await test('line ending: preserves CRLF line endings', async () => {
        resetStorage();
        const rwh = await createRwh();
        const text = 'Line 1\r\nLine 2\r\nLine 3';
        const lineEnding = rwh._detectLineEnding(text);
        const textLines = text.split(/\r?\n/);
        const result = textLines.join(lineEnding);
        
        assertEqual(lineEnding, '\r\n', 'should detect CRLF');
        assertEqual(result, 'Line 1\r\nLine 2\r\nLine 3', 'should preserve CRLF');
    });

    await test('line ending: preserves LF line endings', async () => {
        resetStorage();
        const rwh = await createRwh();
        const text = 'Line 1\nLine 2\nLine 3';
        const lineEnding = rwh._detectLineEnding(text);
        const textLines = text.split(/\r?\n/);
        const result = textLines.join(lineEnding);
        
        assertEqual(lineEnding, '\n', 'should detect LF');
        assertEqual(result, 'Line 1\nLine 2\nLine 3', 'should preserve LF');
    });

    await test('line ending: defaults to CRLF for empty text', async () => {
        resetStorage();
        const rwh = await createRwh();
        const text = '';
        const lineEnding = rwh._detectLineEnding(text);
        
        assertEqual(lineEnding, '\r\n', 'should default to CRLF for empty text');
    });

    await test('line ending: defaults to CRLF for text without line endings', async () => {
        resetStorage();
        const rwh = await createRwh();
        const text = 'Single line';
        const lineEnding = rwh._detectLineEnding(text);
        
        assertEqual(lineEnding, '\r\n', 'should default to CRLF when no line endings found');
    });

    await test('line ending: handles mixed line endings (prefers CRLF)', async () => {
        resetStorage();
        const rwh = await createRwh();
        const text = 'Line 1\r\nLine 2\nLine 3';
        const lineEnding = rwh._detectLineEnding(text);
        
        assertEqual(lineEnding, '\r\n', 'should prefer CRLF when both present');
    });

    await test('menus register: repeated calls are idempotent for menu ids and click handler', async () => {
        resetMenuMocks();

        const rwhMenus = await import('../modules/menus.mjs');
        await rwhMenus.register();
        await rwhMenus.register();

        const menuIds = createdMenus.map((m) => m.id).filter((id) => typeof id === 'string');
        const uniqueMenuIds = new Set(menuIds);

        assertEqual(menuIds.length, uniqueMenuIds.size, 'menu ids should remain unique after repeated register calls');
        assertEqual(menuClickHandlers.length, 1, 'exactly one onClicked handler should remain after repeated register calls');
    });
}

await runAllTests();

if (failures > 0) {
    process.exitCode = 1;
    console.error(`Tests failed: ${failures}`);
} else {
    console.log('All tests passed.');
}
