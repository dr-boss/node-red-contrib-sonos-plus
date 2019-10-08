const SonosHelper = require('./SonosHelper.js');
const helper = new SonosHelper();

module.exports = function (RED) {
  'use strict';

  function SonosControlPlayerNode (config) {
    /**  Create Control Player Node and subscribe to messages
    * @param  {Object} config current node configuration data
    */

    RED.nodes.createNode(this, config);
    const sonosFunction = 'create node control player';
    // verify config node. if valid then set status and subscribe to messages
    const node = this;
    const configNode = RED.nodes.getNode(config.confignode);
    const isValid = helper.validateConfigNodeV3(configNode);
    if (isValid) {
      // clear node status
      node.status({});
      // subscribe and handle input message
      node.on('input', function (msg) {
        node.debug('node on - msg received');
        // check again configNode - in the meantime it might have changed
        const isStillValid = helper.validateConfigNodeV3(configNode);
        if (isStillValid) {
          helper.identifyPlayerProcessInputMsg(node, configNode, msg, function (ipAddress) {
            if (typeof ipAddress === 'undefined' || ipAddress === null ||
              (typeof ipAddress === 'number' && isNaN(ipAddress)) || ipAddress === '') {
              // error handling node status, node error is done in identifyPlayerProcessInputMsg
              node.debug('Did NOT found thoe sonos player');
            } else {
              node.debug('Found sonos player');
              handleInputMsg(node, msg, ipAddress);
            }
          });
        } else {
          helper.showError(node, new Error('n-r-c-s-p: Please modify config node'), sonosFunction, 'process message - invalid configNode');
        }
      });
    } else {
      helper.showError(node, new Error('n-r-c-s-p: Please modify config node'), sonosFunction, 'setup subscribe - invalid configNode');
    }
  }

  // ------------------------------------------------------------------------------------

  /**  Validate sonos player and input message then dispatch further.
  * @param  {Object} node current node
  * @param  {Object} msg incoming message
  * @param  {string} ipaddress IP address of sonos player
  */
  function handleInputMsg (node, msg, ipaddress) {
    const sonosFunction = 'handle input msg';
    // get sonos player
    const { Sonos } = require('sonos');
    const sonosPlayer = new Sonos(ipaddress);
    if (typeof sonosPlayer === 'undefined' || sonosPlayer === null ||
      (typeof sonosPlayer === 'number' && isNaN(sonosPlayer)) || sonosPlayer === '') {
      helper.showError(node, new Error('n-r-c-s-p: Check configuration'), sonosFunction, 'invalid sonos player.');
      return;
    }

    // Check msg.payload. Store lowercase version in command
    if (typeof msg.payload === 'undefined' || msg.payload === null ||
      (typeof msg.payload === 'number' && isNaN(msg.payload)) || msg.payload === '') {
      helper.showError(node, new Error('n-r-c-s-p: invalid payload ' + JSON.stringify(msg)), sonosFunction, 'invalid payload');
      return;
    }

    let command = String(msg.payload);
    command = command.toLowerCase();
    let commandWithParam = {};

    // dispatch
    const basicCommandList = ['play', 'pause', 'stop', 'toggleplayback', 'mute', 'unmute', 'next_song', 'previous_song', 'join_group', 'leave_group', 'activate_avtransport'];
    if (basicCommandList.indexOf(command) > -1) {
      handleCommandBasic(node, msg, sonosPlayer, command);
    } else if (command === 'play_notification') {
      handlePlayNotification(node, msg, sonosPlayer);
      // TODO lab_ function
    } else if (command === 'lab_play_notification') {
      node.warn('lab_... is depreciated. Please use play_notification');
      handlePlayNotification(node, msg, sonosPlayer);
      // TODO lab_ function
    } else if (command === 'lab_play_uri') {
      handleLabPlayUri(node, msg, sonosPlayer);
    } else if (command.startsWith('+')) {
      commandWithParam = { cmd: 'volume_increase', parameter: command };
      handleNewVolumeCommand(node, msg, sonosPlayer, commandWithParam);
    } else if (command.startsWith('-')) {
      commandWithParam = { cmd: 'volume_decrease', parameter: command };
      handleNewVolumeCommand(node, msg, sonosPlayer, commandWithParam);
    } else if (!isNaN(parseInt(command))) {
      commandWithParam = { cmd: 'volume_set', parameter: command };
      handleNewVolumeCommand(node, msg, sonosPlayer, commandWithParam);
    } else {
      node.status({ fill: 'green', shape: 'dot', text: 'warning:depatching commands - invalid command' });
      node.warn('dispatching commands - invalid command: ' + command);
    }
  }

  // ------------------------------------------------------------------------------------

  /**  Handle basic commands to control sonos player.
  * @param  {Object} node current node
  * @param  {Object} msg incoming message
  * @param  {Object} sonosPlayer Sonos Player
  * @param  {string} cmd command - no parameter
  */
  function handleCommandBasic (node, msg, sonosPlayer, cmd) {
    const sonosFunction = cmd;
    switch (cmd) {
      case 'play':
        sonosPlayer.play()
          .then(() => {
            if (typeof msg.volume === 'undefined' || msg.volume === null ||
              (typeof msg.volume === 'number' && isNaN(msg.volume)) || msg.volume === '') {
              // dont touch volume
            } else {
              const newVolume = parseInt(msg.volume);
              if (Number.isInteger(newVolume)) {
                if (newVolume > 0 && newVolume < 100) {
                  node.debug('is in range ' + newVolume);
                  sonosPlayer.setVolume(newVolume);
                } else {
                  node.debug('is not in range: ' + newVolume);
                  throw new Error('n-r-c-s-p: msg.volume is out of range 1 ... 100');
                }
              } else {
                node.debug('msg.volume is not number');
                throw new Error('n-r-c-s-p: msg.volume is not a number');
              }
            }
            helper.showSuccess(node, sonosFunction);
          })
          .catch(error => helper.showError(node, error, sonosFunction, 'error caught from response or throw'));
        break;

      case 'stop':
        sonosPlayer.stop()
          .then(helper.showSuccess(node, sonosFunction))
          .catch(error => helper.showError(node, error, sonosFunction, 'error caught from response'));
        break;

      case 'pause':
        sonosPlayer.pause()
          .then(helper.showSuccess(node, sonosFunction))
          .catch(error => helper.showError(node, error, sonosFunction, 'error caught from response'));
        break;

      case 'toggleplayback':
        sonosPlayer.togglePlayback()
          .then(helper.showSuccess(node, sonosFunction))
          .catch(error => helper.showError(node, error, sonosFunction, 'error caught from response'));
        break;

      case 'mute':
        sonosPlayer.setMuted(true)
          .then(helper.showSuccess(node, sonosFunction))
          .catch(error => helper.showError(node, error, sonosFunction, 'error caught from response'));
        break;

      case 'unmute':
        sonosPlayer.setMuted(false)
          .then(helper.showSuccess(node, sonosFunction))
          .catch(error => helper.showError(node, error, sonosFunction, 'error caught from response'));
        break;

      case 'next_song':
        //  CAUTION! PRERQ: there should be a next song. Only a few stations support that (example Amazon Prime)
        sonosPlayer.next()
          .then(helper.showSuccess(node, sonosFunction))
          .catch(error => helper.showError(node, error, sonosFunction, 'error caught from response'));
        break;

      case 'previous_song':
        //  CAUTION! PRERQ: there should be a previous song. Only a few stations support that (example Amazon Prime)
        sonosPlayer.previous(false)
          .then(helper.showSuccess(node, sonosFunction))
          .catch(error => helper.showError(node, error, sonosFunction, 'error caught from response'));
        break;

      case 'leave_group':
        sonosPlayer.leaveGroup()
          .then(helper.showSuccess(node, sonosFunction))
          .catch(error => helper.showError(node, error, sonosFunction, 'error caught from response'));
        break;

      case 'join_group': {
        if (typeof msg.topic === 'undefined' || msg.topic === null ||
          (typeof msg.topic === 'number' && isNaN(msg.topic)) || msg.topic === '') {
          helper.showError(node, new Error('n-r-c-s-p: invalid topic ' + JSON.stringify(msg)), sonosFunction, 'invalid topic');
          return;
        }

        const deviceToJoing = msg.topic;
        sonosPlayer.joinGroup(deviceToJoing)
          .then(helper.showSuccess(node, sonosFunction))
          .catch(error => helper.showError(node, error, sonosFunction, 'error caught from response'));
        break;
      }
      case 'activate_avtransport':
        if (typeof msg.topic === 'undefined' || msg.topic === null ||
          (typeof msg.topic === 'number' && isNaN(msg.topic)) || msg.topic === '') {
          helper.showError(node, new Error('n-r-c-s-p: invalid topic ' + JSON.stringify(msg)), sonosFunction, 'invalid topic');
          return;
        }
        sonosPlayer.setAVTransportURI(msg.topic)
          .then(() => {
            if (typeof msg.volume === 'undefined' || msg.volume === null ||
              (typeof msg.volume === 'number' && isNaN(msg.volume)) || msg.volume === '') {
              // dont touch volume
            } else {
              const newVolume = parseInt(msg.volume);
              if (Number.isInteger(newVolume)) {
                if (newVolume > 0 && newVolume < 100) {
                  node.debug('is in range ' + newVolume);
                  sonosPlayer.setVolume(newVolume);
                } else {
                  node.debug('is not in range: ' + newVolume);
                  throw new Error('n-r-c-s-p: msg.volume is out of range 1 ... 100');
                }
              } else {
                node.debug('msg.volume is not number');
                throw new Error('n-r-c-s-p: msg.volume is not a number');
              }
            }
            helper.showSuccess(node, sonosFunction);
          })
          .catch(error => helper.showError(node, error, sonosFunction, 'error caught from response'));
        break;
    }
  }

  /**  Send set/adjust volume command to sonos player.
  * @param  {Object} node current node
  * @param  {Object} msg incoming message
  * @param  {Object} sonosPlayer Sonos Player
  * @param  {Object} commandObject command - cmd and parameter both as string or volume as integer
  * special: volume range 0 .. 100, adjust volume rage -30 ..  +30
  */
  function handleNewVolumeCommand (node, msg, sonosPlayer, commandObject) {
    const sonosFunction = commandObject.cmd;
    const volumeValue = parseInt(commandObject.parameter); // convert to integer
    switch (commandObject.cmd) {
      case 'volume_set':
        if (Number.isInteger(volumeValue)) {
          if (volumeValue > 0 && volumeValue < 100) {
            node.debug('is in range:' + volumeValue);
          } else {
            helper.showError(node, new Error('n-r-c-s-p: volume is out of range: ' + volumeValue), sonosFunction, 'out of range');
            return;
          }
        } else {
          helper.showError(node, new Error('n-r-c-s-p: volume is not valid number: ' + volumeValue), sonosFunction, 'out of range');
          return;
        }
        sonosPlayer.setVolume(volumeValue)
          .then(helper.showSuccess(node, sonosFunction))
          .catch(error => helper.showError(node, error, sonosFunction, 'error caught from response'));
        break;
      case 'volume_decrease':
      case 'volume_increase':
        if (Number.isInteger(volumeValue)) {
          if (volumeValue > -30 && volumeValue < 30) {
            node.debug('is in range ' + volumeValue);
          } else {
            helper.showError(node, new Error('n-r-c-s-p: volume is out of range: ' + volumeValue), sonosFunction, 'out of range');
            return;
          }
        } else {
          helper.showError(node, new Error('n-r-c-s-p: volume is not valid number: ' + volumeValue), sonosFunction, 'out of range');
          return;
        }
        sonosPlayer.adjustVolume(volumeValue)
          .then(helper.showSuccess(node, sonosFunction))
          .catch(error => helper.showError(node, error, sonosFunction, 'error caught from response'));
        break;
    }
  }

  /**  Play Notification.
  * @param  {Object} node current node
  * @param  {Object} msg incoming message
  * @param  {Object} sonosPlayer Sonos Player
  * uses msg.topic (uri) and optional msg.volume (default is 40)
  */
  function handlePlayNotification (node, msg, sonosPlayer) {
    const sonosFunction = 'play notification';
    // validate msg.topic.
    if (typeof msg.topic === 'undefined' || msg.topic === null ||
      (typeof msg.topic === 'number' && isNaN(msg.topic)) || msg.topic === '') {
      helper.showError(node, new Error('n-r-c-s-p: invalid topic ' + JSON.stringify(msg)), sonosFunction, 'invalid topic');
      return;
    }
    // validate msg.volume - use default as backup
    let notificationVolume;
    const defaultVolume = 40;
    if (typeof msg.volume === 'undefined' || msg.volume === null ||
      (typeof msg.volume === 'number' && isNaN(msg.volume)) || msg.volume === '') {
      notificationVolume = defaultVolume; // default
    } else {
      notificationVolume = parseInt(msg.volume);
      if (Number.isInteger(notificationVolume)) {
        if (notificationVolume > 0 && notificationVolume < 100) {
          node.debug('is in range ' + notificationVolume);
        } else {
          node.debug('is not in range: ' + notificationVolume);
          notificationVolume = defaultVolume;
          node.warn('volume value out of range - set to default');
        }
      } else {
        node.debug('is not number');
        notificationVolume = defaultVolume;
        node.warn('invalid volume - corrected to default');
      }
    }
    const uri = String(msg.topic).trim();
    node.debug('notification volume ' + String(notificationVolume));
    sonosPlayer.playNotification(
      {
        uri: uri,
        onlyWhenPlaying: false,
        volume: notificationVolume // Change the volume for the notification, and revert back afterwards.
      })
      .then(helper.showSuccess(node, sonosFunction))
      .catch(error => helper.showError(node, error, sonosFunction, 'error caught from response'))
      .finally(() => node.debug('process id- finally ' + process.pid));
  }

  /**  LAB: For testing only : Play mp3
  * @param  {Object} node current node
  * @param  {Object} msg incoming message
  * @param  {Object} sonosPlayer Sonos Player
  * uses msg.topic
  */
  function handleLabPlayUri (node, msg, sonosPlayer) {
    const sonosFunction = 'lab play uri';
    // Check msg.topic.
    if (typeof msg.topic === 'undefined' || msg.topic === null ||
      (typeof msg.topic === 'number' && isNaN(msg.topic)) || msg.topic === '') {
      helper.showError(node, new Error('n-r-c-s-p: invalid topic ' + JSON.stringify(msg)), sonosFunction, 'invalid topic');
      return;
    }
    const uri = String(msg.topic).trim();
    sonosPlayer.play(uri)
      .then(helper.showSuccess(node, sonosFunction))
      .catch(error => helper.showError(node, error, sonosFunction, 'error caught from response'));
  }
  RED.nodes.registerType('sonos-control-player', SonosControlPlayerNode);
};
