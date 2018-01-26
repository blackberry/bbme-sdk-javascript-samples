/*
 * Copyright (c) 2018 BlackBerry.  All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/**
 * A simple chat program.
 *
 * @class SimpleChat
 * @memberof Examples
 */

HTMLImports.whenReady(function() {
  // Find the necessary HTMLElements and cache them.
  var title = document.getElementById('title');
  var status = document.getElementById('status');
  var chatInput = document.getElementById('chatInput');
  var chatMessageList = document.getElementById('chatMessageList');
  var chatList = document.getElementById('chatList');
  var chatListDiv = document.getElementById('chatListDiv');
  var leaveButton = document.getElementById('leaveButton');
  var bubbleTemplate = document.getElementById('bubbleTemplate');

  // Perform authentication.
  try {
    var authHelper = new GenericAuthHelper();
    authHelper.authenticate(AUTH_CONFIGURATION)
    .then(function(userInfo) {
      try {
        // Construct BBMEnterprise.Messenger which provides higher level
        // functionality used to manipulate and annotate chats.
        var bbmsdk = new BBMEnterprise({
          domain: ID_PROVIDER_DOMAIN,
          environment: ID_PROVIDER_ENVIRONMENT,
          userId: userInfo.id,
          getToken: () => authHelper.getOAuthAccessToken(AUTH_CONFIGURATION),
          getKeyProvider: (regId, accessToken) => 
            FirebaseKeyProvider.factory.createInstance(
              regId,
              firebaseConfig,
              accessToken,
              setupNeededMsg => console.warn(setupNeededMsg)),
          description: navigator.userAgent,
          messageStorageFactory: BBMEnterprise.StorageFactory.SpliceWatcher
        });

        // Notify the user that we are working on signing in.
        status.innerHTML = 'signing in';
      } catch (error) {
        showError('Failed to create BBMEnterprise: ' + error);
        return;
      }

      // Initialize BBM Enterprise SDK for Javascript and start the setup.
      bbmsdk.setup()
      .then(function(chatInterfaces) {

        var messenger = chatInterfaces.messenger;

        // Initialize the components once they are ready.

        // Initialize the chat input.
        window.customElements.whenDefined(chatInput.localName)
        .then(function() {
          chatInput.setBbmMessenger(messenger);
        });

        // Initialize the message list.
        window.customElements.whenDefined(chatMessageList.localName)
        .then(function() {
          chatMessageList.setBbmMessenger(messenger);
          chatMessageList.setContext({
            /**
             * A function to retrieve the status indicator to use for a message.
             *
             * @param {BBMEnterprise.ChatMessage} message
             *   The message to retrieve status for.
             * @returns {string}
             *   (R) for read messages, (D) for delivered messages, nothing
             *   otherwise.
             */
            getMessageStatus: function(message) {
              if(message.isIncoming) {
                return '';
              }

              switch(message.state.value) {
                case 'Sending':
                  return '(...)';
                case 'Sent':
                  return '(S)';
                case 'Delivered':
                  return '(D)';
                case 'Read':
                  return '(R)';
                case 'Failed':
                  return '(F)';
                default:
                  return '(?)';
              }
            },

            /**
             * A function to retrieve the content to use for a message.
             *
             * @param {BBMEnterprise.Messenger.ChatMessage} message
             *   The message to retrieve content for.
             * @returns {string}
             *   The content for a Text message, and other appropriate values
             *   for other types of messages.
             */
            getMessageContent: function(message) {
              if(message.tag === 'Text') {
                return message.content;
              } else {
                return message.tag;
              }
            },

            /**
             * A function to retrieve the alignment to use for a message.
             *
             * @param {BBMEnterprise.ChatMessage} message
             *   The message to retrieve alignment for.
             * @returns {string}
             *   The alignment for the message.
             */
            getMessageAlignment: function(message) {
              return message.isIncoming ? 'right' : 'left';
            }
          });
        });

        // Initialize the chat list.
        window.customElements.whenDefined(chatList.localName)
        .then(function() {
          chatList.setBbmMessenger(messenger);
          chatList.setContext({
            // Get the name to use for the chat. This is the other participant's
            // registration ID for a 1:1 chat, otherwise it is the chat's
            // subject.
            getChatName: function(chat) {
              if(chat.isOneToOne) {
                if(chat.participants[0].regId ===
                   bbmsdk.getRegistrationInfo().regId) {
                  return chat.participants[1].regId.toString();
                } else {
                  return chat.participants[0].regId.toString();
                }
              } else {
                return chat.subject;
              }
            }
          });
        });

        // The message list needs to know about changes to the message
        // store.

        // Report the status to the user.
        status.innerHTML = 'Registration Id: ' +
                           bbmsdk.getRegistrationInfo().regId;
      })
      .catch(function(error) {
        showError("BBM SDK setup error: " + error);
      });
    }).catch(function(error) {
      showError("Failed to complete setup: " + error);
    });
  } catch(error) {
    showError("Failed to authenticate and start BBM SDK error="+error);
  }
});

//============================================================================
// :: HTML functions
//
// The remaining functions are called from the HTML code

/**
 * Enter the message list for a chat.
 *
 * @param {HTMLElement} element
 *   The list element of the chat to enter.
 */
function enterChat(element) {
  var chatId = element.id;

  // Initialize the component.
  chatMessageList.chatId = chatId;
  chatInput.setChatId(chatId);

  // Make the right things visible.
  chatListDiv.style.display = "none";
  chatMessageList.style.display = "block";
  chatInput.style.display = "block";
  leaveButton.style.display = "block";

  // Set the title
  title.innerHTML = element.innerHTML;
}

/**
 * Leave the active chat. This takes us back to the chat list.
 */
function leaveChat() {
  // Uninitialize the components.
  chatMessageList.chatId = undefined;

  // Make the right things visible.
  chatListDiv.style.display = "block";
  chatMessageList.style.display = "none";
  chatInput.style.display = "none";
  leaveButton.style.display = "none";

  // Set the title
  title.innerHTML = 'Simple Chat';
}

/**
 * Display an error message in the status area.
 *
 * @param {string} message
 *   The error message to display.
 */
function showError(message) {
  console.log(message);
  // GOTCHA: This renders unsanitized text as html. In a real application, use
  // your framework's method, or some other method, to sanitize the text prior
  // to displaying it.
  document.getElementById('status').innerHTML = message;
}
