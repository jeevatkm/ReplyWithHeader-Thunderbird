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
    },
    {
        id: 'rwh_about',
        title: 'About',
    },
    {
        id: `separator-${separatorIdCounter++}`,
        type: 'separator',
    },
    {
        id: 'rwh_donate_paypal',
        title: 'Donate via PayPal',
    },
    {
        id: 'rwh_sponsor_github',
        title: 'Sponsor via GitHub',
    }
];

const messageDisplayActionMenus = [
    {
        id: 'rwh_disable_10s',
        title: 'Disable for 10s',
        contexts: ['message_display_action_menu'],
    },
    {
        id: 'rwh_all_headers_10s',
        title: 'Enable all headers in forward for 10s',
        contexts: ['message_display_action_menu'],
    }
];

let onMenuClickedHandler = null;

const badgeCounters = new Map();
let badgeActionCounter = 0;

async function getFirstDisplayedMessage(tabId) {
    try {
        let messageList = await messenger.messageDisplay.getDisplayedMessages(tabId);
        return messageList?.messages?.[0] || null;
    } catch (e) {
        rwhLogger.warn('Unable to resolve displayed message', e);
        return null;
    }
}

function startStatusBadge(tabId) {
    let existing = badgeCounters.get(tabId);
    if (existing) {
        if (existing.intervalId) {
            clearInterval(existing.intervalId);
        }
        if (existing.timeoutId) {
            clearTimeout(existing.timeoutId);
        }
    }

    let actionId = ++badgeActionCounter;
    let intervalId = setInterval(showStatusBadge, 1000, tabId);
    badgeCounters.set(tabId, { seconds: 10, intervalId: intervalId, timeoutId: null, actionId: actionId });
    messenger.messageDisplayAction.setBadgeText({ text: '10s', tabId: tabId });

    return { intervalId: intervalId, actionId: actionId };
}

function showStatusBadge(tabId) {
    let state = badgeCounters.get(tabId);
    if (!state) {
        return;
    }

    state.seconds--;
    if (state.seconds <= 0) {
        if (state.intervalId) {
            clearInterval(state.intervalId);
            state.intervalId = null;
        }
        messenger.messageDisplayAction.setBadgeText({ text: null, tabId: tabId });
        return;
    }

    messenger.messageDisplayAction.setBadgeText({ text: `${state.seconds}s`, tabId: tabId });
}

async function setPrefAndSetDelayClear(obj) {
    rwhLogger.debug('set', obj);
    await rwhSettings.set(obj.prefName, obj.value);

    let state = badgeCounters.get(obj.tabId);
    if (state?.actionId !== obj.actionId) {
        return;
    }
    if (state.timeoutId) {
        clearTimeout(state.timeoutId);
    }
    state.timeoutId = setTimeout(delayedRemove, delayedDeleteMillisecond, obj);
}

async function delayedRemove(obj) {
    let state = badgeCounters.get(obj.tabId);
    if (!state || state.actionId !== obj.actionId) {
        return;
    }

    rwhLogger.debug('clear', obj);
    if (state.intervalId) {
        clearInterval(state.intervalId);
    }
    if (state.timeoutId) {
        clearTimeout(state.timeoutId);
    }
    badgeCounters.delete(obj.tabId);
    messenger.messageDisplayAction.setBadgeText({ text: null, tabId: obj.tabId });
    await rwhSettings.remove(obj.prefName);
}

export async function register() {
    // Keep registration idempotent when background scripts are reloaded.
    const knownMenuIds = [
        toolsRootMenu.id,
        ...toolsActionMenus.map((menu) => menu.id).filter((id) => typeof id === 'string'),
        ...messageDisplayActionMenus.map((menu) => menu.id).filter((id) => typeof id === 'string'),
    ];

    for (let menuId of knownMenuIds) {
        try {
            await messenger.menus.remove(menuId);
        } catch (e) {
            // Ignore when menu doesn't exist.
        }
    }

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

    //
    // Menu Click Handler
    //

    if (!onMenuClickedHandler) {
        onMenuClickedHandler = async (info, tab) => {
            switch (info.menuItemId) {
                case 'rwh_options':
                    await rwhSettings.set('options.ui.target.command', 'openHeadersTab');
                    messenger.runtime.openOptionsPage();
                    break;
                case 'rwh_about':
                    await rwhSettings.set('options.ui.target.command', 'openAboutTab');
                    messenger.runtime.openOptionsPage();
                    break;
                case 'rwh_donate_paypal':
                    messenger.windows.openDefaultBrowser(rwhSettings.paypalDonateUrl);
                    break;
                case 'rwh_sponsor_github':
                    messenger.windows.openDefaultBrowser(rwhSettings.gitHubSponsorUrl);
                    break;
                case 'rwh_disable_10s':
                    let message = await getFirstDisplayedMessage(tab.id);
                    if (!message?.id) {
                        return;
                    }
                    let prefName = `disable.message_${message.id}`;
                    let badgeState = startStatusBadge(tab.id);
                    await setPrefAndSetDelayClear({
                        prefName: prefName,
                        intervalId: badgeState.intervalId,
                        actionId: badgeState.actionId,
                        value: true,
                        tabId: tab.id,
                    });
                    break;
                case 'rwh_all_headers_10s':
                    let message2 = await getFirstDisplayedMessage(tab.id);
                    if (!message2?.id || !message2?.folder?.accountId) {
                        return;
                    }
                    let prefName2 = `header.fwd.all.${message2.folder.accountId}.message_${message2.id}`;
                    let badgeState2 = startStatusBadge(tab.id);
                    await setPrefAndSetDelayClear({
                        prefName: prefName2,
                        intervalId: badgeState2.intervalId,
                        actionId: badgeState2.actionId,
                        value: true,
                        tabId: tab.id,
                    });
                    break;
            }
        };
    }

    const hasOnClickedListener = messenger.menus.onClicked.hasListener?.(onMenuClickedHandler) || false;
    if (!hasOnClickedListener) {
        messenger.menus.onClicked.addListener(onMenuClickedHandler);
    }

}
