var resources = [],
    productHandlers = {
        AMAZON: amazonProductParseHandler,
        EBAY: ebayProductParseHandler,
        ADIKA: adikaProductParseHandler
    },
    productPurchasedHandlers = {
        AMAZON: amazonProductPurchasedHandler
    },
    consts = {
        ST_PANEL_FILE_NAME: "st-panel.html",
        ST_STICKER_FILE_NAME: "st-sticker.html",
        JQUERY_RESOURCE_NAME: "jquery.js",
        BACKGROUND_SCRIPT: "background-script",
        CONTENT_SCRIPT: "content-script",
        ST_CONNECTION_NAME: "st-connection",
        EVENTS: {
            PRODUCT_PARSED: "product-parsed",
            PRODUCT_PURCHASED: "product-purchased",
            USER_IDENTIFIED: "user-identified"
        },
        HOST_NAME_TO_URL: {
            AMAZON: "www.amazon.com",
            EBAY: "www.ebay.com",
            ADIKA: "www.adikastyle.com"
        },
        HOST_NAMES: {
            AMAZON: "AMAZON",
            EBAY: "EBAY",
            ADIKA: "ADIKASTYLE"
        }
    },
    THIS_SCRIPT = consts.CONTENT_SCRIPT,
    connectedPort,
    productOwner,
    productChangedCallback,
    customerID;

if (!jQuery) {
    injectScript(consts.JQUERY_RESOURCE_NAME);
}

chrome.runtime.onConnect.addListener(function(port) {
    console.assert(port.name == consts.ST_CONNECTION_NAME);

    console.log('connected to background script', port);

    connectedPort = port;

    productOwner = findCorrectHost(window.location.href);

    jQuery(document).ready(connectionCreatedHandler);

    connectedPort.onMessage.addListener(messageReceivedHandler);
});

function connectionCreatedHandler() {
    if (resources.length) {
        for (var resourceName in resources) {
            injectScript(resources[resourceName]);
        }
    }

    if (productOwner && productHandlers[productOwner]) {
        initiateSticker();

        productHandlers[productOwner]();
    }
}

function initiateSticker() {
    var stickerElement = jQuery("#st-sticker");

    if (!stickerElement.length) {
        jQuery.get(chrome.extension.getURL(consts.ST_STICKER_FILE_NAME), function(data) {
            jQuery("body").prepend(data);

            jQuery.get(chrome.extension.getURL(consts.ST_PANEL_FILE_NAME), function(data) {
                jQuery("body").append(data);

                jQuery('#st-panel-link').panelslider({
                    bodyClass: 'ps-active-right',
                    // clickClose: false,
                    onOpen: function() {
                        console.log('st panel open');
                    }
                });

                jQuery('#close-panel-bt').click(function() {
                    jQuery.panelslider.close();
                });

                jQuery('#st-panel').on('psBeforeOpen psOpen psBeforeClose psClose', function(e) {
                    console.log(e.type, e.target.getAttribute('id'));
                });

                fixSTPanelWidth();
            });
        });

        // Check for browsers that don't support CSS3 transforms or IE's filters
        // if (feedback_btn.style.Transform == undefined && feedback_btn.style.WebkitTransform == undefined && feedback_btn.style.MozTransform == undefined && feedback_btn.style.OTransform == undefined && feedback_btn.filters == undefined) {

        //     // Swap width with height, change padding
        //     // stickerLink.style.width = "15px";
        //     stickerLink.style.height = "35px";
        //     stickerLink.style.padding = "16px 8px";

        //     // Insert vertical SVG text
        //     stickerLink.innerHTML = "<p>ShopTogether</p>";
        // }
    }
}

function fixSTPanelWidth() {
    jQuery("#st-panel").css('width', (productOwner === consts.HOST_NAMES.EBAY) ? '220px' : '260px');
}

function messageReceivedHandler(data) {
    console.assert(data.sender === consts.BACKGROUND_SCRIPT);

    console.log('[' + consts.BACKGROUND_SCRIPT + ' => ' + THIS_SCRIPT + ']: ' + data);
}

function amazonProductParseHandler() {
    var loginPageIdentifiers = ['#ap_email', '#ap_password'],
        productPageIdentifiers = ['#one-click-button', '#add-to-cart-button'],
        bulkParsedData = [],
        currentCustomerID = window.$Nav ? window.$Nav.getNow('config.lightningDeals').customerID : null;

    if (customerID !== currentCustomerID) {
        customerID = currentCustomerID;

        bulkParsedData.push({
            event: consts.EVENTS.USER_IDENTIFIED,
            data: getHashCode(productOwner.concat(currentCustomerID))
        });
    }

    // If it's a login page, we can identify user against the server using his email
    if (doesPageHasIdentifiers(loginPageIdentifiers)) {

    } else if (doesPageHasIdentifiers(productPageIdentifiers)) {
        var anyPriceElements,
            priceDetails,
            anyShippingElement,
            shippingDetails,
            anySavingsElement, savingsDetails;

        if (jQuery('#ourprice_shippingmessage').length) {
            anyShippingElement = jQuery('#ourprice_shippingmessage');
        } else if (jQuery('#dealprice_shippingmessage').length) {
            anyShippingElement = jQuery('#dealprice_shippingmessage');
        }

        if (anyShippingElement) {
            shippingDetails = anyShippingElement.text().toLowerCase().trim().split(' ');

            if (shippingDetails) {
                // Remove first non letter character
                shippingDetails.shift();

                if (shippingDetails.length > 2) {
                    shippingDetails.pop();
                    // Remove dot after shipping
                    shippingDetails[shippingDetails.length - 1] = shippingDetails[shippingDetails.length - 1].replace('.', '');
                }

                shippingDetails = shippingDetails.join(' ');
            }
        }

        if (jQuery('#priceblock_ourprice').length) {
            anyPriceElements = jQuery('#priceblock_ourprice');
        } else if (jQuery('#priceblock_dealprice').length) {
            anyPriceElements = jQuery('#priceblock_dealprice');
        } else if (jQuery('.kindle-price > td').length) {
            priceDetails = jQuery('.kindle-price > td').next().text().trim().split(' ')[0].trim();
        }

        if (anyPriceElements) {
            priceDetails = anyPriceElements.text();
        }

        if (jQuery('#regularprice_savings').length) {
            anySavingsElement = jQuery('#regularprice_savings').children().next();
        } else if (jQuery('#dealprice_savings').length) {
            anySavingsElement = jQuery('#dealprice_savings').children().next();
        } else if (jQuery('.kindle-price > td').length) {
            anySavingsElement = jQuery('.kindle-price > td').next().children();
        }

        // If it's a deal of the day
        if (anySavingsElement) {
            var promoLabel = jQuery("#priceblock_dealprice_lbl").text(),
                promoInfo = jQuery("#priceblock_dealprice_lbl").next().children(),
                youSaveCashData = removeEscapeChars(anySavingsElement.text().toLowerCase()).replace('save', '').trim();

            // if (promoLabel.indexOf(':') > -1) {
            //     promoLabel = promoLabel.substr(0, promoLabel.indexOf(':'));
            // }

            savingsDetails = {
                // label: promoLabel,
                // price: promoInfo.first().text(),
                // additionalDetails: promoInfo.next().children().children().not('a').text() || null,
                amount: youSaveCashData.substr(0, youSaveCashData.indexOf(' ')),
                percent: youSaveCashData.substr(youSaveCashData.lastIndexOf(' ') + 1)
            };
        }

        var parsedProduct = {
            url: window.location.href,
            title: jQuery('#title > span').first().text().trim(),
            subtitle: jQuery('#title > span').next().text().trim() || null,
            byline: {
                name: jQuery('#centerCol').find('#brand').text() || jQuery('#centerCol').find('#byline > span > a').text(),
                link: convertToFullURL((jQuery('#centerCol').find('#brand').attr('href') || jQuery('#centerCol').find('#byline > span > a').attr('href')))
            },
            price: priceDetails || null,
            shipping: shippingDetails || null,
            savings: savingsDetails || null,
            img: jQuery('#main-image-container').find('img').attr('src'),
            customersRank: jQuery('#centerCol').find('#acrPopover').attr('title'),
            breadcrumbs: [],
            availability: jQuery('#availability').text().trim(),
            purchased: false
        };

        jQuery('#wayfinding-breadcrumbs_feature_div > ul > li').not('.a-breadcrumb-divider').find('.a-list-item > a').each(function() {
            parsedProduct.breadcrumbs.push({
                name: jQuery(this).text().trim(),
                link: convertToFullURL(jQuery(this).attr('href'))
            });
        });

        if (jQuery("#buyOneClick").parent().length) {
            jQuery("#buyOneClick").parent().on('click', productPurchasedHandlers[productOwner]);
        } else if (jQuery("#oneClickAvailable").parent().parent().length) {
            jQuery("#oneClickAvailable").parent().parent().on('click', productPurchasedHandlers[productOwner]);
        } else if (jQuery("#add-to-cart-button").parent().parent().parent().length) {
            jQuery("#add-to-cart-button").parent().parent().parent().on('click', productPurchasedHandlers[productOwner]);
        }

        console.log('parsed product ', parsedProduct);

        bulkParsedData.push({
            event: consts.EVENTS.PRODUCT_PARSED,
            data: parsedProduct
        });
    } else {
        console.log('non product page found');
    }

    if (bulkParsedData.length > 0) {
        connectedPort.postMessage({
            sender: consts.CONTENT_SCRIPT,
            data: bulkParsedData
        });
    }
}

function amazonProductPurchasedHandler() {
    console.assert(connectedPort);

    var purchasedProduct = {
        url: window.location.href,
        quantity: jQuery('#quantity').val(),
        purchased: true
    };

    connectedPort.postMessage({
        sender: consts.CONTENT_SCRIPT,
        event: consts.EVENTS.PRODUCT_PURCHASED,
        data: purchasedProduct
    });

    // connectedPort.disconnect();
}

function ebayProductParseHandler() {}

function adikaProductParseHandler() {}

function convertToFullURL(relativePath) {
    return window.location.hostname + relativePath;
}

function getHashCode(str) {
    var hash = 0,
        i, chr, len;
    if (str.length === 0) return hash;
    for (i = 0, len = str.length; i < len; i++) {
        chr = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}

function doesPageHasIdentifiers(identifiers) {
    for (var k in identifiers) {
        if ($(identifiers[k]).length > 0) {
            return true;
        }
    }

    return false;
}

function findCorrectHost(url) {
    var hostName = getHostName(url);

    for (var k in consts.HOST_NAME_TO_URL) {
        if (consts.HOST_NAME_TO_URL[k] === hostName) {
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

function removeEscapeChars(text) {
    var tt = text.replace(/[-[\]{}()*+?",\\^|#\s]/g, " ");

    // tt = tt.replace(/\r?\n|\r/g, "");

    return tt.trim();
}

function injectScript(resourceName) {
    console.log('injecting ', resourceName);

    if (resourceName.indexOf('.css') > -1) {
        injectStyle(resourceName);
    } else {
        var injScript = document.createElement('script');
        injScript.src = chrome.extension.getURL(resourceName);
        injScript.type = "text/javascript";
        (document.head || document.documentElement).appendChild(injScript);
        injScript.parentNode.removeChild(injScript);
    }
}

function injectStyle(resourceName) {
    var head = document.head || document.getElementsByTagName('head')[0],
        style = document.createElement('style');

    style.type = 'text/css';
    style.href = chrome.extension.getURL(resourceName);

    head.appendChild(style);
}
