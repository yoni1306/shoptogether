var socket = io.connect('http://localhost:8080', {
        reconnect: true
    }),
    consts = {
        JQUERY_RESOURCE_NAME: "jquery.js",
        BACKGROUND_SCRIPT: "background-script",
        CONTENT_SCRIPT: "content-script",
        REALTIME_EVENT_NAME: "st-realtime-event",
        ST_CONNECTION_NAME: "st-connection",
        EVENTS: {
            PRODUCT_PARSED: "product-parsed",
            PRODUCT_PURCHASED: "product-purchased",
            USER_IDENTIFIED: "user-identified"
        },
        HOSTS: {
            AMAZON: "www.amazon.com",
            EBAY: "www.ebay.com",
            ADIKA: "www.adikastyle.com",
            ASOS: "www.asos.com"
        }
    },
    EXTENSION_ID = chrome.runtime.id,
    THIS_SCRIPT = consts.BACKGROUND_SCRIPT,
    allowedHosts = [];

initAllowedHosts();

chrome.tabs.onActivated.addListener(function(activeInfo) {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function(tabs) {
        STExecuter(tabs[0]);
    });
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status == 'complete' && tab.active) {
        STExecuter(tab);
    }
});

function STExecuter(tab) {
    var hostName = findCorrectHost(tab.url);

    if (hostName && allowedHosts.indexOf(hostName) !== -1) {
        var port = chrome.tabs.connect(tab.id, {
            name: consts.ST_CONNECTION_NAME
        });

        port.onMessage.addListener(messageReceivedHandler);
    }
}

function messageReceivedHandler(data) {
    console.assert(data.sender === consts.CONTENT_SCRIPT);

    console.log('[' + consts.CONTENT_SCRIPT + ' => ' + THIS_SCRIPT + ']: ' + data);

    sendDataToServer(data);
}

function sendDataToServer(data) {
    if (socket) {
        socket.emit(
            consts.REALTIME_EVENT_NAME,
            JSON.stringify(data),
            // This function will be called when server receives
            // this event, and the response argument will be defined
            // by the server
            function(response) {
                if (response.error) {
                    // Oh no, I cannot set to that name.
                } else {
                    // Awesome, I can set to that name!
                }

                console.log(response);
            }
        );
    } else {
        // Try to reconnect
        console.log('trying to reconnect');

        socket = io.connect('http://localhost:8080', {
            reconnect: true
        });

        console.log('resending data', data);

        sendDataToServer(data);
    }
}

socket.on('event', function(data) {
    console.log('great 1');
});

socket.on('disconnect', function() {
    console.log('great 2');
});

function initAllowedHosts() {
    for (var k in consts.HOSTS) {
        allowedHosts.push(k);
    }
}

function findCorrectHost(url) {
    var hostName = getHostName(url);

    for (var k in consts.HOSTS) {
        if (consts.HOSTS[k] === hostName) {
            return k;
        }
    }

    return null;
}

function getHostName(url) {
    var parser = document.createElement('a');

    parser.href = url;

    return parser.hostname;
    // parser.protocol; // => "http:"
    // parser.host; // => "example.com:3000"
    // parser.hostname; // => "example.com"
    // parser.port; // => "3000"
    // parser.pathname; // => "/pathname/"
    // parser.hash; // => "#hash"
    // parser.search; // => "?search=test"
}
