/*
 * Copyright (c) Jeevanandam M. (jeeva@myjeeva.com)
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at
 * https://github.com/jeevatkm/ReplyWithHeaderMozilla/blob/master/LICENSE
 */

import { rwhLogger } from './modules/logger.mjs';
import * as rwhMenus from './modules/menus.mjs';
import * as rwhCompose from './modules/compose.mjs';
import * as rwhTabs from './modules/tabs.mjs';
import * as rwhSettings from './modules/settings.mjs';
import * as rwhAccounts from './modules/accounts.mjs';
import * as rwhI18n from './modules/headers-i18n.mjs';

messenger.runtime.onInstalled.addListener(async function (details) {
    // About 'details' argument
    // Refer here: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onInstalled
    rwhLogger.debug(details);

    let identities = await rwhAccounts.allIdentities();
    rwhSettings.setIdentityDefaults(identities);
});

messenger.identities.onCreated.addListener(async function (identityId, identity) {
    rwhLogger.debug('onCreated', identityId, identity);
    rwhSettings.setDefault(`identity.${identityId}.enabled`, true);
});

messenger.identities.onDeleted.addListener(async function (identityId) {
    rwhLogger.debug('onDeleted', identityId);
    rwhSettings.remove(`identity.${identityId}.enabled`);
});

async function detectLocaleAndSetAsDefault() {
    let userSelected = await rwhSettings.isHeaderLocaleUserSelected();
    rwhLogger.debug(`userSelected:`, userSelected);
    if (userSelected) {
        return;
    }

    let uiLocale = messenger.i18n.getUILanguage();
    let selected = rwhI18n.i18n.lang[uiLocale];
    rwhLogger.debug('uiLocale:', uiLocale, 'selected pref:', selected);
    if (typeof selected === 'undefined') {
        rwhLogger.info(`Currently does not have support for locale '${uiLocale}', fallback to 'en-US'`);
        await rwhSettings.set('header.locale', 'en-US');
        return;
    }

    let currentLocale = await rwhSettings.getHeaderLocale();
    rwhLogger.debug('current selected Locale:', currentLocale);
    if (currentLocale !== uiLocale) {
        await rwhSettings.set('header.locale', uiLocale);
    }
}

async function init() {
    await rwhSettings.setDefaults();

    await rwhMenus.register();

    rwhTabs.register('messageCompose', async (tab) => {
        await rwhCompose.process(tab);
    });

    await detectLocaleAndSetAsDefault();

    let tbInfo = await messenger.runtime.getBrowserInfo();
    let tbPlatformInfo = await messenger.runtime.getPlatformInfo();
    let manifestInfo = messenger.runtime.getManifest();
    rwhLogger.info(`Add-on v${manifestInfo.version} loaded successfully (TB v${tbInfo.version}, Platform: ${tbPlatformInfo.os} ${tbPlatformInfo.arch})`);
}

try {
    init();
} catch (e) {
    rwhLogger.error(e);
}
