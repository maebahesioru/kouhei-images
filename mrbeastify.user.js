// ==UserScript==
// @name         MrBeastify YouTube
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  YouTubeサムネイルにMrBeastオーバーレイを適用
// @author       You
// @match        *://*.youtube.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ============================================
    // ⚠️ ここを自分のGitHubリポジトリに変更してください
    // 例: https://cdn.jsdelivr.net/gh/username/mrbeastify-images
    // ============================================
    const IMAGE_BASE_URL = 'https://cdn.jsdelivr.net/gh/maebahesioru/kouhei-images/image';
    const TOTAL_IMAGES = 40;

    const EXTENSION_NAME = 'MrBeastify';

    // 設定の読み込み
    let extensionIsDisabled = GM_getValue('extensionIsDisabled', false);
    let appearChance = GM_getValue('appearChance', 1.0);
    let flipChance = GM_getValue('flipChance', 0.25);

    // Flip blacklist (元の拡張機能から)
    let useAlternativeImages = false;
    let flipBlacklist = [];

    // 最後に選ばれた画像のインデックス（重複防止用）
    const size_of_non_repeat = 8;
    const last_indexes = Array(size_of_non_repeat).fill(-1);

    // 画像URLを取得
    function getImageURL(index) {
        return `${IMAGE_BASE_URL}/${index}.png`;
    }

    // ランダムな画像インデックスを取得（重複防止）
    function getRandomImageFromDirectory() {
        let randomIndex = -1;

        if (TOTAL_IMAGES <= size_of_non_repeat) {
            last_indexes.fill(-1);
        }

        while (last_indexes.includes(randomIndex) || randomIndex < 0) {
            randomIndex = Math.floor(Math.random() * TOTAL_IMAGES) + 1;
        }

        last_indexes.shift();
        last_indexes.push(randomIndex);

        return randomIndex;
    }

    // オーバーレイを適用
    function applyOverlay(thumbnailElement, overlayImageURL, flip = false) {
        const overlayImage = document.createElement('img');
        overlayImage.id = EXTENSION_NAME;
        overlayImage.src = overlayImageURL;

        // ランダムで左・中央・右を選択
        const positions = ['left', 'center', 'right'];
        const position = positions[Math.floor(Math.random() * positions.length)];

        let leftValue, translateX;
        switch (position) {
            case 'left':
                leftValue = '0%';
                translateX = '0%';
                break;
            case 'right':
                leftValue = '100%';
                translateX = '-100%';
                break;
            default: // center
                leftValue = '50%';
                translateX = '-50%';
        }

        overlayImage.style.cssText = `
            position: absolute;
            top: 50%;
            left: ${leftValue};
            height: 100%;
            transform: translate(${translateX}, -50%) ${flip ? 'scaleX(-1)' : ''};
            z-index: 0;
            pointer-events: none;
        `;
        thumbnailElement.parentElement.insertBefore(
            overlayImage,
            thumbnailElement.nextSibling
        );
    }

    // サムネイルを検索
    function findThumbnails() {
        const imageSelectors = [
            'ytd-thumbnail a > yt-image > img.yt-core-image',
            'img.style-scope.yt-img-shadow[width="86"]',
            '.yt-thumbnail-view-model__image img',
            'img.ytCoreImageHost',
        ];

        const allImages = [];
        for (const selector of imageSelectors) {
            allImages.push(...Array.from(document.querySelectorAll(selector)));
        }

        const targetAspectRatio = [16 / 9, 4 / 3];
        const errorMargin = 0.02;

        let listAllThumbnails = allImages.filter((image) => {
            if (image.height === 0) return false;
            const aspectRatio = image.width / image.height;
            return (
                Math.abs(aspectRatio - targetAspectRatio[0]) < errorMargin ||
                Math.abs(aspectRatio - targetAspectRatio[1]) < errorMargin
            );
        });

        const videoWallImages = document.querySelectorAll('.ytp-videowall-still-image');
        const cuedThumbnailOverlays = document.querySelectorAll('div.ytp-cued-thumbnail-overlay-image');
        listAllThumbnails.push(...videoWallImages, ...cuedThumbnailOverlays);

        return listAllThumbnails.filter((image) => {
            const parent = image.parentElement;
            const isVideoPreview =
                parent.closest('#video-preview') !== null ||
                Array.from(parent.classList).some((cls) => cls.includes('ytAnimated'));
            const isChapter = parent.closest('#endpoint') !== null;

            const processed = Array.from(parent.children).filter((child) => {
                return child.id && child.id.includes(EXTENSION_NAME);
            });

            return processed.length === 0 && !isVideoPreview && !isChapter;
        });
    }

    // サムネイルにオーバーレイを適用
    function applyOverlayToThumbnails() {
        const thumbnailElements = findThumbnails();

        thumbnailElements.forEach((thumbnailElement) => {
            const loops = Math.random() > 0.001 ? 1 : 20; // Easter egg

            for (let i = 0; i < loops; i++) {
                let flip = Math.random() < flipChance;
                let imageIndex = getRandomImageFromDirectory();

                if (flip && flipBlacklist.includes(imageIndex)) {
                    if (useAlternativeImages) {
                        // 代替画像があれば使用（textFlippedフォルダ）
                        // jsDelivrでは事前に確認が難しいので、flipをオフにする
                        flip = false;
                    } else {
                        flip = false;
                    }
                }

                const overlayImageURL = Math.random() < appearChance ? getImageURL(imageIndex) : '';
                if (overlayImageURL) {
                    applyOverlay(thumbnailElement, overlayImageURL, flip);
                }
            }
        });
    }

    // Flip blacklistを読み込み
    async function loadFlipBlacklist() {
        try {
            const response = await fetch(`${IMAGE_BASE_URL}/flip_blacklist.json`);
            const data = await response.json();
            useAlternativeImages = data.useAlternativeImages || false;
            flipBlacklist = data.blacklistedImages || [];
            console.log(`${EXTENSION_NAME}: Flip blacklist loaded.`);
        } catch (error) {
            console.log(`${EXTENSION_NAME}: No flip blacklist found, proceeding without it.`);
        }
    }

    // 設定メニュー（Tampermonkeyメニューから）
    function registerMenuCommands() {
        GM_registerMenuCommand(
            extensionIsDisabled ? '✅ 有効化' : '❌ 無効化',
            () => {
                extensionIsDisabled = !extensionIsDisabled;
                GM_setValue('extensionIsDisabled', extensionIsDisabled);
                alert(`MrBeastify: ${extensionIsDisabled ? '無効' : '有効'}になりました。ページを再読み込みしてください。`);
            }
        );

        GM_registerMenuCommand(`🎲 出現確率: ${Math.round(appearChance * 100)}%`, () => {
            const input = prompt('出現確率を入力 (0-100):', Math.round(appearChance * 100));
            if (input !== null) {
                const value = Math.max(0, Math.min(100, parseInt(input) || 100));
                appearChance = value / 100;
                GM_setValue('appearChance', appearChance);
                alert(`出現確率を ${value}% に設定しました。ページを再読み込みしてください。`);
            }
        });

        GM_registerMenuCommand(`🔄 反転確率: ${Math.round(flipChance * 100)}%`, () => {
            const input = prompt('反転確率を入力 (0-100):', Math.round(flipChance * 100));
            if (input !== null) {
                const value = Math.max(0, Math.min(100, parseInt(input) || 25));
                flipChance = value / 100;
                GM_setValue('flipChance', flipChance);
                alert(`反転確率を ${value}% に設定しました。ページを再読み込みしてください。`);
            }
        });
    }

    // メイン処理
    async function main() {
        if (extensionIsDisabled) {
            console.log(`${EXTENSION_NAME} is disabled.`);
            return;
        }

        registerMenuCommands();
        await loadFlipBlacklist();

        // 100msごとにサムネイルをチェック
        setInterval(applyOverlayToThumbnails, 100);
        console.log(`${EXTENSION_NAME} loaded successfully. ${TOTAL_IMAGES} images available.`);
    }

    main();
})();
