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

globalThis.messenger = {
    i18n: {
        getUILanguage() {
            return currentUILang;
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
}

await runAllTests();

if (failures > 0) {
    process.exitCode = 1;
    console.error(`Tests failed: ${failures}`);
} else {
    console.log('All tests passed.');
}
