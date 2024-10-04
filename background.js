browser.spaces
  .create("trello_board", browser.runtime.getURL("board.html"), {
    title: "Trello Board",
    defaultIcons: {
      32: "icons/icon-32.png",
      64: "icons/icon-64.png",
    },
    themeIcons: [
      {
        light: "icons/icon-32-light.png",
        dark: "icons/icon-32-dark.png",
        size: 32,
      },
    ],
  })
  .then((space) => {
    console.log(`Trello board space created with ID: ${space.id}`);
  })
  .catch((error) => {
    console.error("Error creating space:", error);
  });

browser.runtime.onMessage.addListener((message) => {
  if (message.action === "openUrl") {
    browser.tabs.create({
      url: message.url,
    });
  }
});
