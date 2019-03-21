const opsgenie = require('opsgenie-sdk');

const MAX_TITLE_EVENT_SIZE = 256;

function stripSpecialChars(str) {
  return str.replace(/[&\/\\#,+()$~%'":*?<>{}]\`/g, "");
}

module.exports = {
  handle: function(event, context, callback) {
    const apiUrl = context.configuration.apiUrl;
    const apiKey = context.configuration.apiKey;
    const data = context.data;
    let system;
    let url = '';
    let score = 0;
    let opsgenieMessage = '';
    let opsgenieDescription = '';
    let opsgenieSource = '';
    let opsgenieAlias = '';
    let opsgenieTags = ['unomaly'];

    opsgenie.configure({
      'host': apiUrl,
      'api_key': apiKey
    });
    
    switch (event) {
      case 'situation':
        let knowns = data.knowns || {};
        let topEv = data.topEvent;
        system = data.systems[topEv.system];
        let systemName = system.alias || system.name;
        opsgenieSource = stripSpecialChars(systemName);
        opsgenieAlias = data.situationId;

        url = data.url;
        score = data.score;
  
        opsgenieMessage = 
         `${topEv.data.substring(0, MAX_TITLE_EVENT_SIZE)}`;
        
         opsgenieDescription += 'See details at ' + url + '\n';

        const hasKnowns = Object.keys(knowns).length > 0;
        if (hasKnowns) {
          const knownNames = Object.keys(knowns).map(
            k => ` <pre>${stripSpecialChars(knowns[k].name)}</pre>`
          );
          opsgenieDescription += 'Contains knowns: ' + knownNames.join(', ') + '\n';

          // Respect tags
          for (var i in knowns) {
            let tags = knowns[i].tags;
            
            if (tags.length > 0) {
              tags.map(t => opsgenieTags.push(t));
            }
          }
        }
        opsgenieDescription += 'Top event:\n';
        opsgenieDescription += '<code>' + topEv.data.substring(0, 10000) + '</code>';
        
        break;
      case 'away':
        system = data.system.alias || data.system.name;
        opsgenieSource = stripSpecialChars(system);
        opsgenieAlias = data.situationId;
        score = data.score;

        const d = new Date();
        const awayMins = (d.getTime() / 1000 - parseInt(data.awaySince, 10)) / 60;
        url = data.url;
        
        opsgenieMessage = `System away for ${awayMins} minutes`;
        opsgenieDescription =
          `System ${opsgenieSource} has been away for ${awayMins} minutes.\n` +
          `See ${url}`;

        break;
      default:
        console.log(`Unknown event ${event}`);
        callback(new Error("Unknown event: " + event));
    }

    let createAlertJson = {
      message: opsgenieMessage,
      alias: opsgenieAlias,
      description: opsgenieDescription,
      // teams: []
      // visibleTo []
      // actions: []
      tags: opsgenieTags,
      // details {}
      // entity: opsgenieEntity,
      // priority: ""
      source: opsgenieSource
    };

    opsgenie.alertV2.create(createAlertJson, function(error, alert) {
      if (error) {
        console.error(error);
        callback(new Error("Err: " + error));
      } else {
        console.log(alert);
        callback(null);
      }
    });
  }
};
