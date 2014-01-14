/*
 * App submission Tracking Initialization
 * Requirements by Gareth Cull
 * https://bugzilla.mozilla.org/show_bug.cgi?id=957347
 * TODO: Post validator error/success message tracking.
 */

define('tracking_app_submit', [], function() {
    if (!_gaq) {
        return;
    }

    var logTracking = false;

    // Step 1: Submit an app button is clicked.
    $('#partnership').on('click', '.submit-app .button', function() {
        _gaq.push([
            '_trackEvent',
            'Sumbit an App CTA',
            'click',
            $(this).text()
        ]);

        if (logTracking) {
            console.log('Submit an app button click tracked...');
        }
    });

    function videoEvent(action, id) {
        _gaq.push([
            '_trackEvent',
            'Interactions with Video',
            action,
            id
        ]);

        if (logTracking) {
            console.log('Video ' + action + ' event tracked...');
        }
    }

    // Step 1: Video playback control.
    // Partners page video playback control.
    function initVideoEvents() {
        $('video').each(function() {
            var $this = $(this);
            var id = $this.closest('.video-item').attr('id');

            $this.on('play', function() {
                videoEvent('play', id);
            }).on('pause', function() {
                videoEvent('pause', id);
            }).on('ended', function() {
                videoEvent('finish', id);
            });
        });
    }

    initVideoEvents();

    function socialLinkEvent(label) {
        _gaq.push([
            '_trackEvent',
            'Follow Firefox Apps',
            'click',
            label
        ]);

        if (logTracking) {
            console.log(label + ' social link event tracked...');
        }
    }

    // Partners page: Social links.
    $('.connected').on('click', '.marketplace a', function() {
        socialLinkEvent('Apps Blog');
    }).on('click', '.twitter a', function() {
        socialLinkEvent('Twitter');
    }).on('click', '.youtube a', function() {
        socialLinkEvent('YouTube Channel');
    }).on('click', '.email a', function() {
        socialLinkEvent('Email');
    });

    // Step 1: Packaged app "select a file" button is clicked.
    $('#upload-app').on('click', function() {
        _gaq.push([
            '_trackEvent',
            'Packaged App Validation',
            'click',
            'Select a file'
        ]);

        if (logTracking) {
            console.log('Packaged app select file button tracked...');
        }
    });

    // Step 3: View app listing click.
    $('.edit-addon-nav').on('click', 'li:last-child a', function() {
        _gaq.push([
            '_trackEvent',
            'Open Preview App Page',
            'click',
            'Preview App from Submission Flow Step 3'
        ]);

        if (logTracking) {
            console.log('View listing click tracked...');
        }
    });

    // Edit page: User submitted "requires flash".
    $('#edit-app-technical').on('submit', 'form', function() {
        if ($('#id_flash:checked').length) {
            _gaq.push([
                '_trackEvent',
                'App Requires Flash Support',
                'click',
                'Yes'
            ]);

            if (logTracking) {
                console.log('App requires flash submission tracked...');
            }
        }
    });

    // Step 2: Validate button triggered failed validation.
    $('#upload-webapp-url').on('upload_errors', function(e, r) {
        var numErrors = r.validation.errors;

        _gaq.push([
            '_trackEvent',
            'Hosted App Validation',
            'unsuccessful',
            numErrors + ' validation errors occurred'
        ]);

        if (logTracking) {
            console.log('Failed verify tracked...');
        }
    }).on('upload_success', function(e, r) { // Successful validation.
        var nonErrors = r.validation.warnings + r.validation.notices;

        _gaq.push([
            '_trackEvent',
            'Hosted App Validation',
            'successful',
            nonErrors + ' validation warnings/notices occurred'
        ]);

        if (logTracking) {
            console.log('Successful verify tracked...');
        }
    });

    // Step 2: App form submitted. Track which app types were selected.
    $('#upload-webapp').on('submit', function() {
        _gaq.push([
            '_setCustomVar',
            14,
            'Selected App Types',
            $('#id_free_platforms').val().join(', '),
            1
        ]);

        if (logTracking) {
            console.log('App types selection tracked...');
        }
    });

    // MDN link was clicked. Opens in a new tab so flow is uninterrupted.
    $('.learn-mdn').on('click', 'a', function() {
        _gaq.push([
            '_trackEvent',
            'MDN Exits',
            'click',
            'MDN App Manifests'
        ]);

        if (logTracking) {
            console.log('MDN link tracked...');
        }
    });

    // Step 3: Form submitted. Track which categories were selected.
    // Track whether 'requires flash' was checked.
    // Track whether 'publish my app as soon as...' was unchecked.
    $('#submit-media').on('submit', function() {
        var cats = [];
        $('.addon-categories input:checked').each(function() {
            cats.push($(this).closest('label').text());
        });

        _gaq.push([
            '_setCustomVar',
            15,
            'Dev: App Category Submitted',
            cats.join(', '),
            1
        ]);

        if ($('#id_publish:checked').length === 0) {
            _gaq.push([
                '_trackEvent',
                "Publish my app in the Firefox Marketplace as soon as it's reviewed",
                'uncheck',
                'Opting Out'
            ]);

            if (logTracking) {
                console.log('Publish soon opt-out tracked...');
            }
        }

        if ($('input[name=flash][value=1]:checked').length) {
            _gaq.push([
                '_trackEvent',
                'App Requires Flash Support',
                'click',
                'Yes'
            ]);

            if (logTracking) {
                console.log('App requires flash submission tracked...');
            }
        }

        if (logTracking) {
            console.log('Category choices tracked...');
        }
    });

    // Step 4: Page loaded.
    if ($('#submit-next-steps').length) {
        _gaq.push([
            '_trackEvent',
            'App Successfully Submitted',
            'onload',
            location.href
        ]);

        if (logTracking) {
            console.log('Step 4 page load tracked...');
        }
    }

    // Step 3 page loaded. Track any errors.
    if ($('#submit-details').length) {
        var numErrors = $('.errorlist:visible').length;
        var fields = [];

        if (!numErrors) {
            return;
        }

        $('.errorlist:visible').each(function() {
            fields.push($(this).closest('div:not(.error)').attr('id') || 'unknown field');
        });

        _gaq.push([
            '_trackEvent',
            'Details Page Submission Errors from Required Fields',
            'error',
            fields.join(', '),
            numErrors
        ]);
    }
});
