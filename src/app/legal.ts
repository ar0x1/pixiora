import { APP_NAME, AUTHOR, CONTACT_EMAIL, SOURCE_URL } from '@/app/constants';

/**
 * Legal copy — Terms, Privacy, Licence.
 *
 * Written to describe what this app *actually* does, not boilerplate: every claim
 * here is verifiable against the source (which is why the licence section links
 * to it). Kept as data so the Info page dialogs show exactly
 * the same words.
 */

export interface LegalSection {
  readonly heading: string;
  readonly body: readonly string[];
}

export interface LegalDocument {
  readonly id: 'terms' | 'privacy' | 'licence';
  readonly title: string;
  readonly summary: string;
  readonly updated: string;
  readonly sections: readonly LegalSection[];
}

export const LEGAL_UPDATED = '7 November 2026';

export const LEGAL_DOCUMENTS: Record<LegalDocument['id'], LegalDocument> = {
  terms: {
    id: 'terms',
    title: 'Terms of Service',
    summary: 'What you agree to by using this app, and what it does not promise.',
    updated: LEGAL_UPDATED,
    sections: [
      {
        heading: '1. What this app is',
        body: [
          `${APP_NAME} is a free, open-source image compression and conversion tool that runs entirely inside your browser. There is no account, no server, and no service to subscribe to.`,
          'By using the app you accept these terms. If you do not accept them, do not use the app.',
        ],
      },
      {
        heading: '2. No warranty',
        body: [
          'The app is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and non-infringement.',
          `Some formats (HEIC, TIFF) are decoded by third-party WebAssembly libraries and may fail on unusual or damaged files. Always keep an unmodified copy of your original image.`,
        ],
      },
      {
        heading: '3. Your responsibility for content',
        body: [
          'You retain all rights to the images you process. Nothing is transmitted off your device, so the app cannot and does not inspect, store or review your files.',
          'You are solely responsible for ensuring you have the right to process the images you open, and for how you use the results.',
        ],
      },
      {
        heading: '4. Acceptable use',
        body: [
          'Do not use the app to process material you have no legal right to handle, or in any way that breaks the law in your jurisdiction.',
          `Do not present ${APP_NAME} as your own work while removing the author credit — the licence requires the attribution to stay.`,
        ],
      },
      {
        heading: '5. Limits of liability',
        body: [
          `To the maximum extent permitted by law, ${AUTHOR} shall not be liable for any claim, damages or other liability arising from the use of this app — including lost, corrupted or degraded image data, or any loss of profit or business.`,
          'This includes data loss caused by a browser crash, a codec failure, or the tab being closed mid-job.',
        ],
      },
      {
        heading: '6. Changes',
        body: [
          'These terms may change as the app evolves. The date at the top of this document always reflects the current version.',
        ],
      },
      {
        heading: '7. Contact',
        body: [`Questions about these terms: ${CONTACT_EMAIL}`],
      },
    ],
  },

  privacy: {
    id: 'privacy',
    title: 'Privacy Policy',
    summary: 'No uploads, no analytics, no cookies. Here is the full detail.',
    updated: LEGAL_UPDATED,
    sections: [
      {
        heading: '1. We do not receive your images',
        body: [
          'Every image is read with the browser File API and processed by WebAssembly codecs that are bundled with the app. No image, thumbnail, filename, EXIF record or result is ever sent to a server.',
          'There is no backend to receive it: the app is static HTML, JavaScript and WASM.',
        ],
      },
      {
        heading: '2. No accounts, no analytics, no tracking',
        body: [
          'There is no sign-up, no login, no third-party analytics, no advertising SDK and no session recording. No cookie is set by this app.',
          'The only network requests are for the app itself (HTML, JS, WASM, fonts) when the page loads, plus — only if you click them — the email and GitHub links in the footer.',
        ],
      },
      {
        heading: '3. What is stored on your device',
        body: [
          'Preferences are written to your browser’s localStorage under the key pixiora-settings-v1. That record contains settings only — never image data, filenames or file contents.',
          'Image data is never written to localStorage, cookies, IndexedDB or the Cache API. Decoded pixels live in memory and are freed when you replace the image, close the workspace or close the tab.',
        ],
      },
      {
        heading: '4. Deleting your data',
        body: [
          'Clearing the site data for this origin in your browser settings removes every stored preference. Nothing survives elsewhere, because nothing was ever sent anywhere.',
        ],
      },
      {
        heading: '5. Third-party code',
        body: [
          'Compression and decoding use open-source WebAssembly codecs (mozjpeg, oxipng, libwebp, libavif, gifenc, SVGO, libheif, UTIF) that are compiled into the app and run locally. None of them makes a network request.',
        ],
      },
      {
        heading: '6. Children',
        body: ['The app collects no personal data from anyone, including children.'],
      },
      {
        heading: '7. Contact',
        body: [`Privacy questions: ${CONTACT_EMAIL}`],
      },
    ],
  },

  licence: {
    id: 'licence',
    title: 'Licence',
    summary: 'MIT — free to use, change and share, with the credit kept intact.',
    updated: LEGAL_UPDATED,
    sections: [
      {
        heading: 'MIT License',
        body: [
          `Copyright © 2026 ${AUTHOR}`,
          'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:',
          'The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.',
          'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.',
        ],
      },
      {
        heading: 'Bundled codecs',
        body: [
          'The app links third-party WebAssembly codecs, each under its own permissive licence (MIT, BSD-3-Clause or Apache-2.0). Their notices are preserved in the source tree; see the repository for the full list.',
        ],
      },
      {
        heading: 'Source code',
        body: [`Complete source: ${SOURCE_URL}`],
      },
    ],
  },
};

export const LEGAL_ORDER: readonly LegalDocument['id'][] = ['terms', 'privacy', 'licence'];
