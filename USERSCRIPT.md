# NovAST Web Bridge (Userscript)

Install this script in Tampermonkey or Greasemonkey to bridge your local NovAST engine with ChatGPT, Gemini, and Claude.

## The Script

```javascript
// ==UserScript==
// @name         NovAST Web Bridge
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Inject surgical AST context directly into web LLMs
// @author       NovAST
// @match        https://chatgpt.com/*
// @match        https://gemini.google.com/*
// @match        https://claude.ai/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// ==/UserScript==

(function() {
    'use strict';

    function injectButton() {
        const targetSelectors = [
            'div[contenteditable="true"]', // Generic
            '#prompt-textarea',           // ChatGPT
            '.input-area',                // Gemini
            'div[role="textbox"]'         // Claude
        ];

        targetSelectors.forEach(selector => {
            const input = document.querySelector(selector);
            if (input && !input.parentElement.querySelector('.novast-btn')) {
                const btn = document.createElement('button');
                btn.innerHTML = '🛰️ Inject NovAST';
                btn.className = 'novast-btn';
                btn.style.cssText = 'margin: 5px; padding: 5px 10px; background: #34d399; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px; z-index: 9999;';
                
                btn.onclick = (e) => {
                    e.preventDefault();
                    fetchContext(input);
                };
                
                input.parentElement.appendChild(btn);
            }
        });
    }

    function fetchContext(input) {
        GM_xmlhttpRequest({
            method: "GET",
            url: "http://localhost:6543/context",
            onload: function(response) {
                const data = JSON.parse(response.responseText);
                if (data.context) {
                    const text = `[SURGICAL CONTEXT]\n${data.context}\n\n`;
                    if (input.contentEditable === "true") {
                        input.innerText = text + input.innerText;
                    } else {
                        input.value = text + input.value;
                    }
                    console.log('NovAST: Context injected.');
                }
            },
            onerror: function(err) {
                alert('NovAST: Failed to connect to local bridge. Ensure LSP is running.');
            }
        });
    }

    setInterval(injectButton, 2000);
})();
```

## How it works
1. NovAST LSP starts a tiny HTTP server on port 6543.
2. The Userscript detects the chat input on ChatGPT/Gemini/Claude.
3. When you click **🛰️ Inject NovAST**, it fetches the latest AST heatmap from your local machine and pastes it into the chat.

**Zero configuration. Surgical context. Web-ready.**
