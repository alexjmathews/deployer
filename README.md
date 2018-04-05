# deployer
Slack application webtask

{
  "dev-vendor.fusiform.co": {
    "domain": "dev-vendor.fusiform.co",
    "config": {
      "dist": "E1ZFZO5NY2VPIN",
      "appName": "Dev FactoryFour Application",
      "repo": "react-factoryfour",
      "bucket": "fusiform-dev-vendor",
      "allowLatest": true
    },
    "currentVersion": "v2.13.1",
    "override": false,
    "target": "v2.13.1",
    "specifiedTarget": "x.x.x",
    "user": "U037H1T8V",
    "admin": "U037H1T8V",
    "channel": "C9X1D3LBC",
    "status": "originShift",
    "callback_id": "dev-vendor.fusiform.co|df4490c6-c256-4f06-b520-309d99f39495",
    "createdAt": 1522961985352,
    "slackMessage": {
      "ok": true,
      "channel": "C9X1D3LBC",
      "ts": "1522961985.000486",
      "message": {
        "text": "",
        "username": "Deployer",
        "bot_id": "BA0QN3H2N",
        "attachments": [
          {
            "author_name": "Initiated by <@U037H1T8V>",
            "fallback": "<@U037H1T8V> is deploying <http://dev-vendor.fusiform.co|dev-vendor.fusiform.co> to v2.13.1",
            "text": "Specified Target was `x.x.x`. Approval requested from <@U037H1T8V>",
            "pretext": "Initiating a deployment on <http://dev-vendor.fusiform.co|dev-vendor.fusiform.co>",
            "title": "Dev FactoryFour Application",
            "footer": "Status: Pending Approval",
            "id": 1,
            "footer_icon": "https://static.factoryfour.com/misc/rings-loading.gif",
            "ts": 1522961985,
            "color": "9958F0",
            "fields": [
              {
                "title": "Current Version",
                "value": "v2.13.1",
                "short": true
              },
              {
                "title": "Target Version",
                "value": "v2.13.1",
                "short": true
              }
            ]
          }
        ],
        "type": "message",
        "subtype": "bot_message",
        "ts": "1522961985.000486"
      },
      "acceptedScopes": [
        "chat:write:bot",
        "post"
      ]
    }
  }
}