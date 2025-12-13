/*
 * Copyright (c) Jeevanandam M. (jeeva@myjeeva.com)
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at
 * https://github.com/jeevatkm/ReplyWithHeaderMozilla/blob/master/LICENSE
 */

// RWH Menu Module

import { rwhLogger } from './logger.mjs';
import * as rwhSettings from './settings.mjs';
import * as rwhNotifications from './notifications.mjs';

let separatorIdCounter = 0;

const delayedDeleteMillisecond = 10000; // 10 secs

const toolsRootMenu = { id: 'rwh_tools_root', title: 'RWH', contexts: ['tools_menu'] };

const toolsActionMenus = [
    {
        id: 'rwh_options',
        title: 'Options',
        onclick: async () => {
            await rwhSettings.set('options.ui.target.command', 'openHeadersTab');
            messenger.runtime.openOptionsPage();
        }
    },
    {
        id: 'rwh_about',
        title: 'About',
        onclick: async () => {
            await rwhSettings.set('options.ui.target.command', 'openAboutTab');
            messenger.runtime.openOptionsPage();
        }
    },
    {
        id: `separator-${separatorIdCounter++}`,
        type: 'separator',
    },
    {
        id: 'rwh_donate_paypal',
        title: 'Donate via PayPal',
        onclick: async () => {
            messenger.windows.openDefaultBrowser(rwhSettings.paypalDonateUrl);
        }
    },
    {
        id: 'rwh_sponsor_github',
        title: 'Sponsor via GitHub',
        onclick: async () => {
            messenger.windows.openDefaultBrowser(rwhSettings.gitHubSponsorUrl);
        }
    }
];

const messageDisplayActionMenus = [
    {
        id: 'rwh_disable_10s',
        title: 'Disable for 10s',
        contexts: ['message_display_action_menu'],
        onclick: async (clickData, tab) => {
            let message = await messenger.messageDisplay.getDisplayedMessage(tab.id);
            let prefName = `disable.message_${message.id}`;
            badgeCounter = 10;
            let intervalId = setInterval(showStatusBadge, 1000, tab.id);
            await setPrefAndSetDelayClear({
                prefName: prefName,
                intervalId: intervalId,
                value: true,
                tabId: tab.id,
            });
            rwhNotifications.show('Add-on is disabled for 10 seconds on currently displayed message');
        }
    },
    {
        id: 'rwh_all_headers_10s',
        title: 'Enable all headers in forward for 10s',
        contexts: ['message_display_action_menu'],
        onclick: async (clickData, tab) => {
            let message = await messenger.messageDisplay.getDisplayedMessage(tab.id);
            let prefName = `header.fwd.all.${message.folder.accountId}.message_${message.id}`;
            badgeCounter = 10;
            let intervalId = setInterval(showStatusBadge, 1000, tab.id);
            await setPrefAndSetDelayClear({
                prefName: prefName,
                intervalId: intervalId,
                value: true,
                tabId: tab.id,
            });
            rwhNotifications.show('Add-on enables forwarding all headers for 10 seconds on currently displayed message');
        }
    }
];

let badgeCounter = 10;
function showStatusBadge(tabId) {
    badgeCounter--;
    messenger.messageDisplayAction.setBadgeText({ text: `${badgeCounter}s`, tabId: tabId });
}

async function setPrefAndSetDelayClear(obj) {
    rwhLogger.debug('set', obj);
    await rwhSettings.set(obj.prefName, obj.value);
    setTimeout(delayedRemove, delayedDeleteMillisecond, obj);
}

async function delayedRemove(obj) {
    rwhLogger.debug('clear', obj);
    clearInterval(obj.intervalId);
    messenger.messageDisplayAction.setBadgeText({ text: null, tabId: obj.tabId });
    await rwhSettings.remove(obj.prefName);
}

export async function register() {
    //
    // Tools Menu
    //

    let rwhMenuId = await messenger.menus.create(toolsRootMenu);

    for (let m of toolsActionMenus) {
        await messenger.menus.create({
            ...m,
            parentId: rwhMenuId,
        });
    }

    //
    // MessageDisplayAction Menus
    //

    for (let m of messageDisplayActionMenus) {
        await messenger.menus.create(m);
    }

}
