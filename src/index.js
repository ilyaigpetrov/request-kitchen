window.Bexer.addGlobalHandler((errorType, errorEvent) => {

  console.log('Global handler caught:', errorType, errorEvent);
  window.lastErrorEvent = errorEvent;
});

window.Bexer.installErrorReporter({
  submissionOpts: {
    sendReportsToEmail: 'ilyaigpetrov+bexer-test@gmail.com',
    sendReportsInLanguages: ['en', 'ru'],
  }
});

console.log('Extension started.');

window.bar = function foo() {
  throw new Error('Err in BG');
};

console.log('Throwing error from bg! Notification is expected.');
window.bar();
