/*
 * Copyright (c) Jeevanandam M. (jeeva@myjeeva.com)
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at
 * https://github.com/jeevatkm/ReplyWithHeaderMozilla/blob/master/LICENSE
 */

import { rwhLogger } from '../modules/logger.mjs';
import * as rwhNotifications from '../modules/notifications.mjs';
import * as rwhSettings from '../modules/settings.mjs';
import * as rwhI18n from '../modules/headers-i18n.mjs';
import * as rwhAccounts from '../modules/accounts.mjs';
import * as rwhUtils from '../modules/utils.mjs';

// Options page localization.
[...document.querySelectorAll('[data-i18n]')].forEach(e => {
  e[e.dataset.i18nValue || 'textContent'] = browser.i18n.getMessage(e.dataset.i18n);
  if (e.dataset.i18nTitle) {
    e.title = browser.i18n.getMessage(e.dataset.i18nTitle);
  }
});

// UI function to hide/show out option tabs.
function tabListClickHandler(elem) {
    let target = elem.target;

    if (target.parentNode.id != 'tabList') return false;

    openRwhTab(target);
}

function openRwhTab(target) {
    rwhLogger.debug(target.id, 'aria-selected=', target.getAttribute('aria-selected'));

    let selectedTab = document.querySelector('[aria-selected="true"]');
    selectedTab.setAttribute('aria-selected', false);
    target.setAttribute('aria-selected', true);

    let panels = document.querySelector('[aria-hidden="false"]');
    panels.setAttribute('aria-hidden', true);

    let panelId = target.getAttribute('aria-controls'),
        panel = document.getElementById(panelId);
    panel.setAttribute('aria-hidden', false);
}

function openPaypal() {
    rwhNotifications.show(browser.i18n.getMessage("paypalNotif"));
    messenger.windows.openDefaultBrowser(rwhSettings.paypalDonateUrl);
}

function openGithub() {
    rwhNotifications.show(browser.i18n.getMessage("githubNotif"));
    messenger.windows.openDefaultBrowser(rwhSettings.gitHubSponsorUrl);
}

function createOptionItem(v, l) {
    return new Option(l,v);
}

async function populateLocale(prefElement) {
    for (var lang in rwhI18n.i18n.lang) {
        prefElement.appendChild(createOptionItem(
            lang, rwhI18n.i18n.lang[lang] + ' (' + lang + ')'
        ));
    }
}

async function populateAccounts() {
    let multiselectCheckboxes = document.getElementById('multiselectCheckboxes');
    let identities = await rwhAccounts.allIdentities();
    for (let identity of identities) {
        let e = rwhUtils.createElementFromString(`<label for="identity_${identity.id}"><input type="checkbox" id="identity_${identity.id}" data-preference="identity.${identity.id}.enabled" />${identity.email}</label>`);
        multiselectCheckboxes.appendChild(e);
    }
}

async function loadPref(prefElement) {
    let type = prefElement.dataset.type || prefElement.getAttribute('type') || prefElement.tagName;
    let name = prefElement.dataset.preference;
    let value = await rwhSettings.get(name, {});
    switch (type) {
        case 'checkbox':
            switch (name) {
                case 'header.html.prefix.line':
                    prefElement.addEventListener('click', function(e) {
                        document.getElementById('hdrHtmlPrefixLineColor').disabled = !e.target.checked;
                    });
                break;
                case 'header.html.font.size':
                    prefElement.addEventListener('click', function(e) {
                        document.getElementById('hdrHtmlFontSizeValue').disabled = !e.target.checked;
                    });
                    document.getElementById('hdrHtmlFontSizeValue').disabled = !value;
                break;
            }
            prefElement.checked = value;
            prefElement.addEventListener('change', () => savePref(prefElement));
            break;
        case 'radiogroup':
            let selectedElement = prefElement.querySelector(`input[type="radio"][value="${value}"]`)
            if (selectedElement) {
                selectedElement.checked = true;
            }
            for (let radio of prefElement.querySelectorAll(`input[type="radio"]`)) {
                radio.addEventListener('change', () => savePref(prefElement))
            }
            break;
        case 'SELECT':
        case 'color':
        case 'text':
            switch (name) {
                case 'header.locale':
                    await populateLocale(prefElement);
                    break;
            }
            prefElement.value = value;
            prefElement.addEventListener('change', () => savePref(prefElement))
            break;
    }
}

async function savePref(prefElement) {
    let type = prefElement.dataset.type || prefElement.getAttribute('type') || prefElement.tagName;
    let name = prefElement.dataset.preference;
    switch (type) {
        case 'checkbox':
            rwhSettings.set(name, !!prefElement.checked);
            break;
        case 'radiogroup':
            let selectedElement = prefElement.querySelector(`input[type="radio"]:checked`)
            if (selectedElement) {
                rwhSettings.set(name, selectedElement.value);
            }
            break;
        case 'SELECT':
        case 'color':
        case 'text':
            switch (name) {
                case 'header.locale':
                    rwhSettings.set('header.locale.user.selected', true);
                    break;
            }

            rwhSettings.set(name, prefElement.value);
            break;
    }
}

// function storageChanged(changes, area) {
//     let changedItems = Object.keys(changes);
//     rwhLogger.info(changedItems);
//     // for (let item of changedItems) {
//     //   if (area == userPrefStorageArea && item == 'userPrefs') {
//     //     this._userPrefs = changes.userPrefs.newValue;
//     //   }

//     //   if (area == 'local' && item == 'defaultPrefs') {
//     //     this._defaultPrefs = changes.defaultPrefs.newValue;
//     //   }
//     // }
// }

let multiselectExpanded = false;

async function init() {
    const elementEventMap = {
        tabList: { type: 'click', callback: tabListClickHandler },
        buttonWebsite: { type: 'click', callback: () => messenger.windows.openDefaultBrowser(rwhSettings.homepageUrl) },
        buttonReview: { type: 'click', callback: () => messenger.windows.openDefaultBrowser(rwhSettings.reviewsPageUrl) },
        buttonIssues: { type: 'click', callback: () => messenger.windows.openDefaultBrowser(rwhSettings.issuesPageUrl) },
        buttonPaypal: { type: 'click', callback: openPaypal },
        buttonGithub: { type: 'click', callback: openGithub },
    }

    for (let [elementId, eventData] of Object.entries(elementEventMap)) {
        document.getElementById(elementId).addEventListener(eventData.type, eventData.callback);
    }

    // Account multi select
    let multiselectIdentity = document.getElementById('multiselectIdentity');
    multiselectIdentity.addEventListener('click', function(e) {
        const multiselectCheckboxes = document.getElementById('multiselectCheckboxes');
        if (!multiselectExpanded) {
            multiselectCheckboxes.style.display = 'block';
            multiselectExpanded = true;
        } else {
            multiselectCheckboxes.style.display = 'none';
            multiselectExpanded = false;
        }
        e.stopPropagation();
    }, true);

    document.addEventListener('click', function(e){
        if (multiselectExpanded) {
            let multiselectCheckboxes = document.getElementById('multiselectCheckboxes');
            multiselectCheckboxes.style.display = 'none';
            multiselectExpanded = false;
        }
    }, false);

    await populateAccounts();

    // Load preferences and attach onchange listeners for auto save.
    let prefElements = document.querySelectorAll('*[data-preference]');
    for (let prefElement of prefElements) {
        await loadPref(prefElement);
    }

    // Add storage change listener.
    // if (!(await messenger.storage.onChanged.hasListener(storageChanged))) {
    //     await messenger.storage.onChanged.addListener(storageChanged);
    // }

    // Workaround way to open tab using 'messenger.storage.local,
    // since TB does not have way to do while calling 'messenger.runtime.openOptionsPage()'
    let command = await rwhSettings.get('options.ui.target.command', null);
    if (command) {
        switch(command) {
            case 'openHeadersTab':
                openRwhTab(document.getElementById('headersTab'));
                break;
            case 'openAboutTab':
                openRwhTab(document.getElementById('aboutTab'));
                break;
        }
        await rwhSettings.remove('options.ui.target.command');
    }

}

window.addEventListener('load', init);
