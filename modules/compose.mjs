/*
 * Copyright (c) Jeevanandam M. (jeeva@myjeeva.com)
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at
 * https://github.com/jeevatkm/ReplyWithHeaderMozilla/blob/master/LICENSE
 */

// RWH Compose Module

import { rwhLogger } from './logger.mjs';
import * as rwhSettings from './settings.mjs';
import * as rwhI18n from './headers-i18n.mjs';
import { abbreviations } from './abbreviation.mjs';
import * as rwhAccounts from './accounts.mjs';
import * as rwhUtils from './utils.mjs';

const positionBeforeEnd = 'beforeend';
const positionAfterBegin = 'afterbegin';
const fwdHdrLookupString = '-------- ';
const plainTextFirstChars = '> ';
const cleanBlockQuoteStyle = 'border:none !important; padding-left:0px !important; margin-left:0px !important;';

export async function process(tab) {
    rwhLogger.debug(`tab.id=${tab.id}, tab.type=${tab.type}, tab.mailTab=${tab.mailTab}`);

    // explicit delay workaround for image lost issue GH#197
    // maximum 2s
    let tabId = tab.id;
    for (let i = 0; i < 10; i++) {
        if (await hasNoMailnewsUrls(tabId)) {
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    let composeDetails = await messenger.compose.getComposeDetails(tabId);
    rwhLogger.debug(composeDetails);
    if (composeDetails.type === 'new') {
        rwhLogger.debug('New message getting composed');
        return;
    }

    // Check identity level disable exists
    let identityId = composeDetails.identityId;
    let accountId = await rwhAccounts.findIdByIdentityId(identityId);
    let isIdentityEnabled = await rwhSettings.isIdentityEnabled(identityId);
    rwhLogger.debug('AccountId', accountId, 'IdentityId:', identityId, 'isIdentityEnabled:', isIdentityEnabled);
    if (!isIdentityEnabled) {
        return; // RWH stops here
    }

    let messageId = composeDetails.relatedMessageId;

    // Check 10s disable exists on message level
    let isMessageLevelDisabled = await rwhSettings.get(`disable.message_${messageId}`);
    rwhLogger.debug('isMessageLevelDisabled', isMessageLevelDisabled);
    if (isMessageLevelDisabled) {
        return; // RWH stops here
    }

    let fullMsg = await messenger.messages.getFull(messageId);
    rwhLogger.debug(fullMsg);

    let rwh = new ReplyWithHeader(accountId, composeDetails, fullMsg).init();
    if (!(rwh.isReply || rwh.isForward)) {
        rwhLogger.warn(`Unsupported compose type ${rwh.composeType}`);
        return; // RWH stops here
    }

    await rwh.process(tab);
}

// This is workaround method to resolve image issue GH#197
// https://github.com/jeevatkm/ReplyWithHeader-Thunderbird/issues/197#issuecomment-3537253277
async function hasNoMailnewsUrls(tabId) {
    // This function could act on the actual DOM by executing a compose script
    // which might be more reliable, but for simplicity of the example we just
    // check the body text here.
    const details = await messenger.compose.getComposeDetails(tabId);
    return (
        !details.body.includes("imap://") &&
        !details.body.includes("mailbox://")
    )
}

class ReplyWithHeader {
    #accountId
    #composeDetails
    #fullMessage
    #document
    #text

    constructor(accountId, composeDetails, fullMessage) {
        this.#accountId = accountId;
        this.#composeDetails = composeDetails;
        this.#fullMessage = fullMessage;
    }

    // Getters
    get composeType() {
        // reply or forward or draft
        return this.#composeDetails.type;
    }

    get isPlainText() {
        return this.#composeDetails.isPlainText;
    }

    get plainTextBody() {
        return this.#composeDetails.plainTextBody;
    }

    get htmlBody() {
        return this.#composeDetails.body;
    }

    get isReply() {
        return this.composeType === 'reply';
    }

    get isForward() {
        return this.composeType === 'forward';
    }

    get targetNodeClassName() {
        if (this.isReply) {
            return 'moz-cite-prefix'
        } else if (this.isForward) {
            return 'moz-email-headers-table'
        }
        return null;
    }

    // Setters


    // Method

    init() {
        rwhLogger.debug(`composeType=${this.composeType}, messageId=${this.#composeDetails.relatedMessageId}, isPlainText=${this.#composeDetails.isPlainText}`);

        return this;
    }

    async process(tab) {
        let result = { isModified: false };
        result.subject = await this._cleanSubjectPrefixes(this.#composeDetails.subject);

        if (this.isPlainText) {
            rwhLogger.debug('Plain Text', this.plainTextBody);
            this.#text = this.plainTextBody;
            result = Object.assign({}, result, await this._processPlainText());
        } else {
            rwhLogger.debug('HTML Content', this.htmlBody);
            this.#document = rwhUtils.createDocumentFromString(this.htmlBody);
            result = Object.assign({}, result, await this._processHtml());
        }

        // Apply it to message compose window
        rwhLogger.debug(result);
        messenger.compose.setComposeDetails(tab.id, result);
    }

    // So called private/internal methods

    async _processHtml() {
        let targetNodeClassName = this.targetNodeClassName;
        let targetNode = this._getByClassName(targetNodeClassName);
        if (!targetNode) {
            rwhLogger.error('Thunderbird email target node (moz-cite-prefix or moz-forward-container) is not found');
            rwhLogger.error('Due to internal changes in Thunderbird. RWH unable to process email headers, contact add-on author');

            // return original value as-is;
            return {
                body: this.#composeDetails.body
            }
        }

        let div = this._createElement('div');
        div.classList.add(targetNodeClassName);

        var headers = {
            'from': await this._extractHeader('from', true, true),
            'to': await this._extractHeader('to', true, true),
            'cc': await this._extractHeader('cc', true, true),
            'date': await this._extractHeader('date', false, true),
            'reply-to': await this._extractHeader('reply-to', true, true),
            'subject': await this._cleanSubjectPrefixes(await this._extractHeader('subject', false, true)),
        }
        rwhLogger.debug(headers);

        let rwhHeaderString = await this._createHtmlHeaders(headers);
        rwhLogger.debug(rwhHeaderString);

        let rwhHeaderHtmlElement = rwhUtils.createElementFromString(rwhHeaderString);
        div.insertAdjacentElement(positionAfterBegin, rwhHeaderHtmlElement);
        targetNode.replaceWith(div);

        // put back the cleaned up <br> tags as-is
        if (this.isReply) {
            // Originally, there's no <br> after the (unindented) cite prefix.
            // With the table style, it looks better with an extra empty line (like everybody else has it).
            div.insertAdjacentElement(positionBeforeEnd, this._createElement('br'));
            div.insertAdjacentElement(positionAfterBegin, this._createElement('br'));

            // blockquote
            if (await rwhSettings.isCleanAllBlockQuoteColor()) { // all
                let bqs = this._getAllByTagName('blockquote');
                for (let b of bqs) {
                    b.setAttribute('style', cleanBlockQuoteStyle);
                }
            } else if (await rwhSettings.isCleanBlockQuoteColor()) { // first level
                let bq = this._getByTagName('blockquote');
                bq.setAttribute('style', cleanBlockQuoteStyle);
            }
        }
        if (this.isForward) {
            let mozForwardContainer = this._getByClassName('moz-forward-container');
            this._cleanNodesUpToClassName(mozForwardContainer, targetNodeClassName);

            // Insert 2 <br> before the headers to make it look like a reply does.
            mozForwardContainer.insertAdjacentElement(positionAfterBegin, this._createElement('br'));
            mozForwardContainer.insertAdjacentElement(positionAfterBegin, this._createElement('br'));
        }

        return {
            body: new XMLSerializer().serializeToString(this.#document),
        }
    }

    async _processPlainText() {
        var headers = {
            'from': await this._extractHeader('from', true, false),
            'to': await this._extractHeader('to', true, false),
            'cc': await this._extractHeader('cc', true, false),
            'date': await this._extractHeader('date', false, false),
            'reply-to': await this._extractHeader('reply-to', true, false),
            'subject': await this._cleanSubjectPrefixes(await this._extractHeader('subject', false, false)),
        }
        rwhLogger.debug(headers);

        let rwhHeaders = await this._createPlainTextHeaders(headers);
        rwhLogger.debug(rwhHeaders);

        let textLines = this.#text.split(/\r?\n/);
        rwhLogger.debug(textLines);

        let uiLocale = messenger.i18n.getUILanguage();
        let locale = await rwhSettings.getHeaderLocale();
        rwhLogger.debug('_processPlainText:: uiLocale:', uiLocale, 'selected pref:', locale);

        let startPos = -1;
        let linesToDelete = 1;
        if (this.isReply) {
            // Reply insert marker by fallback order
            var lookupValues = new Array(
                rwhI18n.i18n['wrote'][locale],
                rwhI18n.i18n['wrote'][uiLocale],
                rwhI18n.i18n['wrote']['en-US'],
                rwhI18n.i18n['originalMessage'][locale],
                rwhI18n.i18n['originalMessage'][uiLocale],
                rwhI18n.i18n['originalMessage']['en-US'],
            );
            rwhLogger.debug('lookupValues -', lookupValues);

            for (let idx in lookupValues) {
                let v = lookupValues[idx];
                let r = this._findPlainTextReplyInsertMarker(textLines, v);
                if (r.found) {
                    rwhLogger.debug(`Found by the index: ${idx} value: ${v}`);
                    startPos = r.startPos;
                    break;
                }
            }
        } else if (this.isForward) {
            linesToDelete = rwhHeaders.length;
            for (let [index, line] of textLines.entries()) {
                if (line.trim().startsWith(fwdHdrLookupString)) {
                    startPos = index;
                    break;
                }
            }
        }

        rwhLogger.debug('startPos -', startPos);
        if (startPos >= 0) {
            rwhLogger.debug('textLines: ', textLines[startPos]);
            textLines.splice(startPos, linesToDelete, ...rwhHeaders);
        }

        // greater than char '> '
        if (await rwhSettings.isCleanQuoteCharGreaterThan()) {
            for (let i = 0; i < textLines.length; i++) {
                if (textLines[i].startsWith(plainTextFirstChars)) {
                    textLines[i] = textLines[i].replace(plainTextFirstChars, '');
                }
            }
        }

        this.#text = textLines.join('\r\n');
        return {
            plainTextBody: this.#text
        }
    }

    async _createHtmlHeaders(headers) {
        let locale = await rwhSettings.getHeaderLocale();
        let headerLabelSeq = await rwhSettings.getHeaderLabelSeqStyle();
        let headerLabelSeqValues = rwhSettings.headerLabelSeqStyleSettings[headerLabelSeq];

        let rwhHeaders = '<div id="rwhHeaders"';
        if (await rwhSettings.isHeaderHtmlPrefixLine()) {
            let borderColor = await rwhSettings.getHeaderHtmlPrefixLineColor();
            rwhHeaders += ` style="border:none;border-top:solid ${borderColor} 1.0pt;padding:3.0pt 0cm 0cm 0cm;width:100%"`
        }
        rwhHeaders += '>';

        // font size
        let fontSizeStyle = '';
        if (await rwhSettings.isHeaderHtmlFontSize()) {
            let fontSizeValue = await rwhSettings.getHeaderHtmlFontSizeValue() ?? null;
            if (fontSizeValue) {
                fontSizeStyle = `;font-size:${fontSizeValue}`;
            }
        }

        headerLabelSeqValues.forEach(function (hdrKey, _) {
            if (hdrKey == 'reply-to' && this.isReply) {
                return;
            }

            let lbl = rwhI18n.i18n[hdrKey][locale]
            if (headerLabelSeq == 1 && hdrKey == 'date') {
                lbl = rwhI18n.i18n['sent'][locale]
            }

            if (headers[hdrKey]) {
                rwhHeaders += '<p style="margin:0cm' + fontSizeStyle + '"><span><b>' + lbl + '</b> ' + headers[hdrKey] + '</span></p>';
            }
        }, this);

        rwhHeaders += await this._handleAllHeadersFlow(false, true);
        rwhHeaders += '</div>';

        return rwhHeaders;
    }

    async _createPlainTextHeaders(headers) {
        let locale = await rwhSettings.getHeaderLocale();
        let headerLabelSeq = await rwhSettings.getHeaderLabelSeqStyle();
        let headerLabelSeqValues = rwhSettings.headerLabelSeqStyleSettings[headerLabelSeq];

        let rwhHeaders = [];
        if (await rwhSettings.isHeaderPlainPrefixText()) {
            rwhHeaders.push(this.isForward
                ? '-------- ' + rwhI18n.i18n.forwardedMessage[locale] + ' --------'
                : '-------- ' + rwhI18n.i18n.originalMessage[locale] + ' --------');
        } else {
            if (this.isForward) {
                rwhHeaders.push('');
            }
        }

        headerLabelSeqValues.forEach(function (hdrKey, _) {
            if (hdrKey == 'reply-to' && this.isReply) {
                return;
            }

            let lbl = rwhI18n.i18n[hdrKey][locale]
            if (headerLabelSeq == 1 && hdrKey == 'date') {
                lbl = rwhI18n.i18n['sent'][locale]
            }

            if (headers[hdrKey]) {
                rwhHeaders.push(lbl + ' ' + headers[hdrKey]);
            }
        }, this);

        let remainingHeaders = await this._handleAllHeadersFlow(false, false);
        if (remainingHeaders.length > 0) {
            rwhHeaders = [...rwhHeaders, ...remainingHeaders];
        }
        rwhHeaders.push('');

        return rwhHeaders;
    }

    async _parseDate(d) {
        let fallback = (' ' + d).slice(1);
        let locale = await rwhSettings.getHeaderLocale();
        let dateFormat = await rwhSettings.getHeaderDateFormat();
        let timeFormat = await rwhSettings.getHeaderTimeFormat();
        let includeTimezone = await rwhSettings.isHeaderTimeZone();

        rwhLogger.debug('Date format: ' + (dateFormat == 1 ? 'UTC' : 'Locale (' + locale + ')')
            + ', Time format: ' + (timeFormat == 1 ? '24-hour' : '12-hour')
            + (includeTimezone ? ', Include short timezone info' : ''))

        let epoch = null;
        try {
            epoch = Date.parse(d);
        } catch (e) {
            rwhLogger.error(error);
            return fallback;
        }

        let pd = new Date(epoch);
        let options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' };

        if (dateFormat == 1) { // Locale date format
            options.timeZone = 'UTC';
            options.timeZoneName = 'short';
        }

        if (timeFormat == 1) {
            options.hour12 = false;
        } else {
            options.hour12 = true;
        }

        if (includeTimezone) {
            options.timeZoneName = 'short';
        }

        let ds = new Intl.DateTimeFormat(locale, options).format(pd);
        ds = ds.replace(/GMT/, 'UTC');
        return ds;
    }

    async _extractHeader(key, clean, escape) {
        let values = this.#fullMessage.headers[key];
        if (!values) {
            return null;
        }

        if (key === 'date') {
            return this._escapeHtml(await this._parseDate(values[0]));
        }

        let pv = [];
        for (let v of values) {
            pv.push((clean ? this._cleanEmail(v) : v));
        }
        return escape ? this._escapeHtml(pv.join(', ')) : pv.join(', ');
    }

    async _extractRemainingHeaders(clean, escape) {
        let remainingHeaders = {};
        for (let key of Object.keys(this.#fullMessage.headers)) {
            if (rwhSettings.headerLabelSeqStyleSettings[0].includes(key)) { continue; }
            remainingHeaders[key] = await this._extractHeader(key, clean, escape);
        }
        return remainingHeaders;
    }

    _findPlainTextReplyInsertMarker(textLines, lookupWord) {
        for (let [index, line] of textLines.entries()) {
            if (line.trim().includes(lookupWord)) {
                return { found: true, startPos: index }
            }
        }
        return { found: false }
    }

    _getByClassName(className) {
        return this.#document?.getElementsByClassName(className)?.[0];
    }

    _getByTagName(tagName) {
        return this._getAllByTagName(tagName)?.[0];
    }

    _getAllByTagName(tagName) {
        return this.#document?.getElementsByTagName(tagName);
    }

    _createElement(tagName) {
        return this.#document?.createElement(tagName);
    }

    _cleanEmail(v) {
        let pv = (v || '').replace(/\\/g, '').replace(/\"/g, '');
        if (pv.startsWith('<')) {
            pv = pv.substring(1, pv.length - 1);
        }
        return pv;
    }

    _escapeHtml(v) {
        return (v || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    }

    _cleanNodesUpToClassName(node, cssClassName) {
        while (node.firstChild) {
            if (node.firstChild?.className?.includes(cssClassName)) {
                break;
            }
            node.removeChild(node.firstChild);
        }
    }

    // replaced by _cleanSubjectPrefixes
    /* async _transformSubjectPrefix(subject) {
        if (!(await rwhSettings.isTransSubjectPrefix())) {
            return subject;
        }

        if (subject.startsWith(rwhSettings.replySubjectPrefix)) {
            return subject.replace(rwhSettings.replySubjectPrefix, 'RE:')
        }
        if (subject.startsWith(rwhSettings.forwardSubjectPrefix)) {
            return subject.replace(rwhSettings.forwardSubjectPrefix, 'FW:');
        }
        return subject;
    } */

    async _handleAllHeadersFlow(clean, escape) {
        if (this.isReply) { return ''; }

        let prefName = `header.fwd.all.${this.#accountId}.message_${this.#composeDetails.relatedMessageId}`;
        let isForwardAllHeaders = await rwhSettings.get(prefName);
        rwhLogger.debug('isForwardAllHeaders', isForwardAllHeaders);
        if (isForwardAllHeaders) {
            let remainingHeaders = await this._extractRemainingHeaders(clean, escape);
            rwhLogger.debug(remainingHeaders);

            if (this.isPlainText) {
                let rwhHeaders = [];
                for (let [key, value] of Object.entries(remainingHeaders)) {
                    rwhHeaders.push(rwhUtils.toPartialCanonicalFormat(key) + ': ' + value);
                }
                return rwhHeaders;
            } else {
                let rwhHeaders = '';
                for (let [key, value] of Object.entries(remainingHeaders)) {
                    rwhHeaders += '<p style="margin:0"><span><b>'
                        + rwhUtils.toPartialCanonicalFormat(key) + ':</b> ' + value + '</span></p>';
                }
                return rwhHeaders;
            }
        }

        return '';
    }

    async _cleanSubjectPrefixes(subject) {
        if (subject === null || subject === undefined) {
            return '';
        }
        if (typeof subject !== 'string') {
            subject = String(subject);
        }
        if (subject.trim().length === 0) {
            return subject;
        }
        // Examples:
        // (keep different type)            FWD: RE: RE: FWD: Test Subject -> FWD: RE: FWD: Test Subject
        // (dont keep different type)       FWD: RE: RE: FWD: Test Subject -> FWD: Test Subject // it only keep type of current action
        // (uset-lang = en; keep original)       FW: AW: WG: Test Subject -> WG: AW: WG: Test Subject
        // (uset-lang = en; dont keep original)  FW: AW: WG: Test Subject -> FW: RE: FW: Test Subject
        //
        // Flow:
        // 1. Split subject to prefix parts by colon and remove space and colon. Safe subject to seperate value. Cover case of custom prefix.
        //  Example: Aw: RE: FWD: AW: Test Subject -> prefixes = [Aw, RE, FWD, AW], subject = "Test Subject", customPrefix = ""
        //  Example: Topic: Aw: RE: FWD: AW: Test Subject -> prefixes = [Aw, RE, FWD, AW], subject = "Test Subject", customPrefix = "Topic: "
        // 2. Get language of second prefix. If no second prefix, set it to user language.
        //  Example: [AW, RE, FWD, AW, RE] -> lang = en-US
        // 3. Reduce by type (reply / forward).
        //  Example: [AW, RE, FWD, AW, RE] -> [AW, FWD, AW]
        // 4. "only one prefix" setting is true, remove all prefixes except current (first) type.
        //  Example: [AW, FWD, AW] -> [AW]
        // 5. "keep original language" setting check. Keep index.
        // 5a. If uset "keep original language" is true, translate first prefix to lang.
        //  Example: uset-lang = en-US; [AW, FW, AW] -> [RE, FW, RE]
        // 5b. If uset "keep original language" is false, transform all prefixes to user selected language.
        //  Example: uset-lang = de; [AW, FWD, AW] -> [AW, WG, AW]
        // 6. If uset "Transform subject prefix" is true, transform prefixes to standard ones (first one in the i18n array).
        //  Example: [Re, Fw, RE, FWD] -> [RE, FW, RE, FW]
        // 7. return customPrefix prefixes joined with colon + space + subject.


        // 1. Step: Split subject
        let customPrefix = '';
        let prefixes = [];
        let subjectText = subject;

        const allPrefixes = new Set([
            ...Object.values(abbreviations.reply).flat(),
            ...Object.values(abbreviations.forward).flat(),
        ]);

        let firstPrefixPos = -1;
        for (let prefix of allPrefixes) {
            let pos = subject.indexOf(prefix + ':');
            if (pos === -1) {
                continue;
            }
            // Require boundary: start or whitespace before the prefix.
            if (pos > 0 && !/\s/.test(subject[pos - 1])) {
                continue;
            }
            if (firstPrefixPos === -1 || pos < firstPrefixPos) {
                firstPrefixPos = pos;
            }
        }

        if (firstPrefixPos !== -1) {
            customPrefix = subject.slice(0, firstPrefixPos);

            let cursor = firstPrefixPos;
            while (cursor < subject.length) {
                let colonPos = subject.indexOf(':', cursor);
                if (colonPos === -1) {
                    break;
                }
                let token = subject.slice(cursor, colonPos).trim();

                if (allPrefixes.has(token)) {
                    prefixes.push(token);
                    cursor = colonPos + 1;
                    if (subject[cursor] === ' ') {
                        cursor++;
                    }
                    continue;
                }

                // Allow a custom prefix between subject prefixes, e.g. "RE: Topic: RE: ..."
                let lookaheadCursor = colonPos + 1;
                if (subject[lookaheadCursor] === ' ') {
                    lookaheadCursor++;
                }
                let nextColonPos = subject.indexOf(':', lookaheadCursor);
                if (nextColonPos !== -1) {
                    let nextToken = subject.slice(lookaheadCursor, nextColonPos).trim();
                    if (allPrefixes.has(nextToken)) {
                        customPrefix += token + ': ';
                        cursor = lookaheadCursor;
                        continue;
                    }
                }

                // Not a prefix and no prefix after it: subject starts here.
                break;
            }
            subjectText = subject.slice(cursor).trim();
        } else {
            return subject;
        }

        // 2. Step: Get language
        let userLang = messenger.i18n.getUILanguage();
        let mailLang = null;
        if (prefixes.length >= 2) {
            let info = this._getPrefixLanguageAndType(prefixes[1]);
            mailLang = info ? info.lang : userLang;
        } else if (prefixes.length === 1) {
            let info = this._getPrefixLanguageAndType(prefixes[0]);
            mailLang = info ? info.lang : userLang;
        } else {
            mailLang = userLang;
        }

        // 3. Step: Reduce by type
        let reducedPrefixes = [];
        let lastType = null;
        for (let prefix of prefixes) {
            let info = this._getPrefixLanguageAndType(prefix);
            if (!info) {
                reducedPrefixes.push(prefix);
                lastType = null;
                continue;
            }
            if (info.type !== lastType) {
                reducedPrefixes.push(prefix);
                lastType = info.type;
            }
        }
        prefixes = reducedPrefixes;
        rwhLogger.debug('Reduced Prefixes:', prefixes);


        // 4. Step: "only one prefix"
        if (await rwhSettings.isOnlyOnePrefix()) {
            prefixes = [prefixes[0]];
        }

        // 5. Step: translate prefixes
        if (await rwhSettings.isKeepOriginalSubjectPrefixLanguage()) {
            // 5a. keep original language (translate first to mailLang)
            let info = this._getPrefixLanguageAndType(prefixes[0]);
            if (info) {
                prefixes[0] = this._translatePrefix(prefixes[0], mailLang, info.index);
            }
        } else {
            // 5b. transform to user selected language
            let transformedPrefixes = [];
            for (let prefix of prefixes) {
                let info = this._getPrefixLanguageAndType(prefix);
                if (info) {
                    let translatedPrefix = this._translatePrefix(prefix, userLang, info.index);
                    transformedPrefixes.push(translatedPrefix);
                } else {
                    transformedPrefixes.push(prefix);
                }
            }
            prefixes = transformedPrefixes;
        }
        rwhLogger.debug('Translated Prefixes:', prefixes);

        // 6. Step: transform to standard prefixes
        if (await rwhSettings.isTransSubjectPrefix()) {
            let transformedPrefixes = [];
            for (let prefix of prefixes) {
                let info = this._getPrefixLanguageAndType(prefix);
                if (info) {
                    let standardPrefixes = abbreviations[info.type][info.lang] || abbreviations[info.type]['en-US'];
                    transformedPrefixes.push(standardPrefixes[0]);
                } else {
                    transformedPrefixes.push(prefix);
                }
            }
            prefixes = transformedPrefixes;
        }
        rwhLogger.debug('Standardized Prefixes:', prefixes);

        // 7. Step: return
        if (prefixes.length === 0) {
            return customPrefix + subjectText;
        }
        return prefixes.join(': ') + ': ' + customPrefix + subjectText;

    }

    // return { lang: langKey, type: 'reply' | 'forward', index: index }
    _getPrefixLanguageAndType(prefix) {
        for (let [langKey, prefixes] of Object.entries(abbreviations.reply)) {
            if (prefixes.includes(prefix)) {
                return { lang: langKey, type: 'reply', index: prefixes.indexOf(prefix) };
            }
        }
        for (let [langKey, prefixes] of Object.entries(abbreviations.forward)) {
            if (prefixes.includes(prefix)) {
                return { lang: langKey, type: 'forward', index: prefixes.indexOf(prefix) };
            }
        }
        return null;
    }

    // return string: single translated prefix
    _translatePrefix(prefix, targetLang, index) {
        let info = this._getPrefixLanguageAndType(prefix);
        if (!info) {
            return prefix;
        }
        let targetPrefixes = abbreviations[info.type][targetLang];
        if (!targetPrefixes) {
            return prefix;
        }
        return targetPrefixes[index] || targetPrefixes[0];
    }

}

export { ReplyWithHeader };