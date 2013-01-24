var z = {
    win: $(window),
    body: $(document.body),
    page: $('#container'),
    context: $('#page').data('context'),
    prefix: (function() {
        try {
            var s = window.getComputedStyle(document.body, '');
            return (Array.prototype.slice.call(s).join('').match(/moz|webkit|ms|khtml/)||(s.OLink===''&&['o']))[0];
        } catch (e) {
            return 'moz';
        }
    })(),
    prefixed: function(property) {
        if (!z.prefix) return property;
        return '-' + z.prefix + '-' + property;
    },
    canInstallApps: true,
    allowAnonInstalls: !!$('body').data('allow-anon-installs'),
    enableSearchSuggestions: !!$('body').data('enable-search-suggestions'),
    confirmBreakNum: 6
};

z.prefixUpper = z.prefix[0].toUpperCase() + z.prefix.substr(1);

(function() {
    _.extend(z, {
        nav: BrowserUtils()
    });

    function trigger() {
        $(window).trigger('saferesize');
    }
    window.addEventListener('resize', _.debounce(trigger, 200), false);
})();

$(document).ready(function() {
    // Initialize email links.
    z.page.on('fragmentloaded', function() {
        $('span.emaillink').each(function() {
            var $this = $(this);
            $this.find('.i').remove();
            var em = $this.text().split('').reverse().join('');
            $this.prev('a').attr('href', 'mailto:' + em);
        });
    });
    if (z.readonly) {
        $('form[method=post]')
            .before(gettext('This feature is temporarily disabled while we ' +
                            'perform website maintenance. Please check back ' +
                            'a little later.'))
            .find('button, input, select, textarea').attr('disabled', true)
            .addClass('disabled');
    }
    var data_user = $('body').data('user');
    _.extend(z, {
        anonymous: data_user.anonymous,
        pre_auth: data_user.pre_auth
    });

    var gaiaCookie = $.cookie('gaia');

    // Set cookie if user is on B2G.
    // TODO: remove this once we allow purchases on desktop/android.
    if (!gaiaCookie && z.capabilities.gaia) {
        $.cookie('gaia', 'true', {path: '/'});

        // reload the fragment for updated content.
        z.page.trigger('refreshfragment');
    }

    // Sets a tablet cookie.
    var tabletCookie = $.cookie('tablet');
    if (!tabletCookie && z.capabilities.tablet) {
        $.cookie('tablet', 'true', {path: '/'});
        if (z.body.hasClass('sony') && !z.body.hasClass('desktop')) {
            // Reload to get the tablet design.
            window.location.reload();
            // TODO: Figure out a smarter way to do this for the real Marketplace.
        }
    }

    stick.basic();
});


z.page.on('fragmentloaded', function() {
    z.apps = {};
    if (z.capabilities.webApps) {
        // Get list of installed apps and mark as such.
        r = window.navigator.mozApps.getInstalled();
        r.onsuccess = function() {
            _.each(r.result, function(val) {
                z.apps[val.manifestURL] = val;
                $(window).trigger('app_install_success',
                                  [val, {'manifest_url': val.manifestURL}, false]);
            });
        };
    }

    // Navigation toggle.
    var $header = $('#site-header'),
        $nav = $header.find('nav ul'),
        $outer = $('html, body');
    $header.on('click', '.menu-button', _pd(function() {
        $nav.addClass('active');
        $('.nav-overlay').addClass('show');
    })).on('click', '.region', _pd(function() {
        $outer.animate({scrollTop: $outer.height()}, 1000);
    }));

    $(window).bind('overlay_dismissed', function() {
       $nav.removeClass('active');
    });

    // Hijack external links if we're within the app.
    if (z.capabilities.chromeless) {
        $('a[rel=external]').attr('target', '_blank');
    }

    // Initialize selected class for currently active search filter (if any).
    function initSelectedFilter() {
        var sortoption = z.getVars();

        $('#filter-sort li a').removeClass('sel');
        switch (sortoption.sort) {
            case 'None':
                $('#filter-sort li.relevancy a').addClass('sel');
                break;
            case 'popularity':
                $('#filter-sort li.popularity a').addClass('sel');
                break;
            case 'rating':
                $('#filter-sort li.rating a').addClass('sel');
                break;
            case '':
            case undefined:
                // If there's nothing selected, the first one is always the
                // default.
                $('#filter-sort li:first-child a').addClass('sel');
        }
    }

    if (z.capabilities.desktop) {
        initSelectedFilter();
    }

    // Header controls.
    $('header').on('click', '.header-button, .search-clear', function(e) {
        var $this = $(this),
            $btns = $('.header-button');

        if ($this.hasClass('dismiss')) {
            // Dismiss looks like back but actually just dismisses an overlay.
            $('#filters').removeClass('show');
        } else if ($this.hasClass('filter')) {
            // `getVars()` defaults to use location.search.
            initSelectedFilter();
            $('#filters').addClass('show');
        } else if ($this.hasClass('search')) {
            z.body.addClass('show-search');
            $btns.blur();
            $('#search-q').focus();
        } else if ($this.hasClass('cancel')) {
            z.body.removeClass('show-search');
            $('#search-q').blur();
            $btns.blur();
        } else if ($this[0].className == 'search-clear') {
            $('#search-q').val('').focus();
        }

        z.page.on('fragmentloaded', function() {
            z.body.removeClass('show-search');
            $('#search-q').blur();
        });
        e.preventDefault();
    });

    // If we ever use the drop-down menu for mobile...
    // z.body.on('click', '.overlay.dropdown.show', function() {
    //     $('.account-links').removeClass('active');
    // }).on('click', '.account-links', function() {
    //     $('<div class="overlay dropdown show">').appendTo(z.body);
    //     $('.account-links').toggleClass('active');
    // });

    // We would use :hover, but we want to hide the menu on fragment load!
    z.body.on('mouseover', '.account-links', function() {
        $('.account-links').addClass('active');
    }).on('mouseout', '.account-links', function() {
        $('.account-links').removeClass('active');
    }).on('click', '.account-links a', function() {
        $('.account-links').removeClass('active');
    }).on('fragmentloaded', function() {
        $('.account-links.active').removeClass('active');
    });

});
