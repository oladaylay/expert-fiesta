// English / Setswana strings for the customer app (brief, Non-functional
// requirements: Language — English and Setswana).
window.STRINGS = {
  en: {
    campaignTitle: 'Spin the Wheel',
    campaignTag: 'Reconnect. Scan. Spin. Win.',
    oddsHeading: 'Prizes and odds',
    startBtn: 'Start',
    smartcardLabel: 'Smartcard number',
    smartcardScan: 'Take a photo of your card',
    mobileLabel: 'Mobile number for your prize messages',
    consentAge: 'I am 18 or older',
    consentTerms: 'I accept the terms and conditions',
    detailsBtn: 'Check my smartcard',
    checking: 'Checking…',
    youreIn: "You're in. One spin per smartcard.",
    spinBtn: 'SPIN',
    spinning: 'Spinning…',
    resultLead: 'Congratulations!',
    resultSub: 'The MultiChoice team will contact you to deliver your prize.',
    refLabel: 'Reference number',
    shareBtn: 'Share',
    tryAgain: 'Try again',
    backToStart: 'Back to start',
    scanQrFirst: 'Please scan the outlet QR code to begin.',
  },
  tn: {
    campaignTitle: 'Dikologa Wili',
    campaignTag: 'Kgokagana. Sikena. Dikologa. Fenya.',
    oddsHeading: 'Dimpho le ditshono',
    startBtn: 'Simolola',
    smartcardLabel: 'Nomoro ya smartcard',
    smartcardScan: 'Tsaya setshwantsho sa karata ya gago',
    mobileLabel: 'Nomoro ya mogala ya melaetsa ya mpho',
    consentAge: 'Ke na le dingwaga tse 18 kgotsa go feta',
    consentTerms: 'Ke dumela melawana le maemo',
    detailsBtn: 'Sekaseka smartcard ya me',
    checking: 'Re a sekaseka…',
    youreIn: 'O tsenye. Phethogo e le nngwe ka smartcard.',
    spinBtn: 'DIKOLOGA',
    spinning: 'E a dikologa…',
    resultLead: 'Re a go akgola!',
    resultSub: 'Setlhopha sa MultiChoice se tla go ikgolaganya go go isetsa mpho ya gago.',
    refLabel: 'Nomoro ya referense',
    shareBtn: 'Abalana',
    tryAgain: 'Leka gape',
    backToStart: 'Boela kwa tshimologong',
    scanQrFirst: 'Tsweetswee sikenya QR code ya lebenkele go simolola.',
  },
};

window.currentLang = localStorage.getItem('mcb_lang') || 'en';
window.t = function t(key) {
  const dict = window.STRINGS[window.currentLang] || window.STRINGS.en;
  return dict[key] || window.STRINGS.en[key] || key;
};
