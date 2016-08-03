/*global Tablesaw:true */

/*
* tablesaw: A set of plugins for responsive tables
* Stack and Column Toggle tables
* Copyright (c) 2013 Filament Group, Inc.
* MIT License
*
* tablesaw core: tables.js
*
*/

if( typeof Tablesaw === "undefined" ) {
  Tablesaw = {
    i18n: {
      modes: [ 'Stack', 'Swipe', 'Toggle' ],
      columns: 'Col<span class=\"a11y-sm\">umn</span>s',
      columnBtnText: 'Columns',
      columnsDialogError: 'No eligible columns.',
      sort: 'Sort'
    },
    // cut the mustard
    mustard: 'querySelector' in document &&
      ( !window.blackberry || window.WebKitPoint ) &&
      !window.operamini
  };
}
if( !Tablesaw.config ) {
  Tablesaw.config = {};
}
if( Tablesaw.mustard ) {
  jQuery( document.documentElement ).addClass( 'tablesaw-enhanced' );
}

;(function( $ ) {
  var pluginName = "table",
    classes = {
      toolbar: "tablesaw-bar"
    },
    events = {
      create: "tablesawcreate",
      destroy: "tablesawdestroy",
      refresh: "tablesawrefresh"
    },
    defaultMode = "stack",
    initSelector = "table[data-tablesaw-mode],table[data-tablesaw-sortable]";

  var Table = function( element ) {
    if( !element ) {
      throw new Error( "Tablesaw requires an element." );
    }

    this.table = element;
    this.$table = $( element );

    this.mode = this.$table.attr( "data-tablesaw-mode" ) || defaultMode;

    this.init();
  };

  Table.prototype.init = function() {
    // assign an id if there is none
    if ( !this.$table.attr( "id" ) ) {
      this.$table.attr( "id", pluginName + "-" + Math.round( Math.random() * 10000 ) );
    }

    this.createToolbar();

    var colstart = this._initCells();

    this.$table.trigger( events.create, [ this, colstart ] );
  };

  Table.prototype._initCells = function() {
    var colstart,
      thrs = this.table.querySelectorAll( "thead tr" ),
      self = this;

    $( thrs ).each( function(){
      var coltally = 0;

      $( this ).children().each( function(){
        var span = parseInt( this.getAttribute( "colspan" ), 10 ),
          sel = ":nth-child(" + ( coltally + 1 ) + ")";

        colstart = coltally + 1;

        if( span ){
          for( var k = 0; k < span - 1; k++ ){
            coltally++;
            sel += ", :nth-child(" + ( coltally + 1 ) + ")";
          }
        }

        // Store "cells" data on header as a reference to all cells in the same column as this TH
        this.cells = self.$table.find("tr").not( thrs[0] ).not( this ).children().filter( sel );
        coltally++;
      });
    });

    return colstart;
  };

  Table.prototype.refresh = function() {
    this._initCells();

    this.$table.trigger( events.refresh );
  };

  Table.prototype.createToolbar = function() {
    // Insert the toolbar
    // TODO move this into a separate component
    var $toolbar = this.$table.prev().filter( '.' + classes.toolbar );
    if( !$toolbar.length ) {
      $toolbar = $( '<div>' )
        .addClass( classes.toolbar )
        .insertBefore( this.$table );
    }
    this.$toolbar = $toolbar;

    if( this.mode ) {
      this.$toolbar.addClass( 'mode-' + this.mode );
    }
  };

  Table.prototype.destroy = function() {
    // Don’t remove the toolbar. Some of the table features are not yet destroy-friendly.
    this.$table.prev().filter( '.' + classes.toolbar ).each(function() {
      this.className = this.className.replace( /\bmode\-\w*\b/gi, '' );
    });

    var tableId = this.$table.attr( 'id' );
    $( document ).unbind( "." + tableId );
    $( window ).unbind( "." + tableId );

    // other plugins
    this.$table.trigger( events.destroy, [ this ] );

    this.$table.removeData( pluginName );
  };

  // Collection method.
  $.fn[ pluginName ] = function() {
    return this.each( function() {
      var $t = $( this );

      if( $t.data( pluginName ) ){
        return;
      }

      var table = new Table( this );
      $t.data( pluginName, table );
    });
  };

  $( document ).on( "enhance.tablesaw", function( e ) {
    // Cut the mustard
    if( Tablesaw.mustard ) {
      $( e.target ).find( initSelector )[ pluginName ]();
    }
  });

}( jQuery ));


/*
* tablesaw: A set of plugins for responsive tables
* Swipe Toggle: swipe gesture (or buttons) to navigate which columns are shown.
* Copyright (c) 2013 Filament Group, Inc.
* MIT License
*
* tablesaw plugin: tables.swipetoggle.js
*
*/

;(function( win, $, undefined ){

  $.extend( Tablesaw.config, {
    swipe: {
      horizontalThreshold: 15,
      verticalThreshold: 30
    }
  });

  function isIE8() {
    var div = document.createElement('div'),
      all = div.getElementsByTagName('i');

    div.innerHTML = '<!--[if lte IE 8]><i></i><![endif]-->';

    return !!all.length;
  }

  var classes = {
    // TODO duplicate class, also in tables.js
    toolbar: "tablesaw-bar",
    hideBtn: "disabled",
    persistWidths: "tablesaw-fix-persist",
    allColumnsVisible: 'tablesaw-all-cols-visible'
  };

  function createSwipeTable( $table ){

    var $btns = $( "<div class='tablesaw-advance'></div>" ),
      $prevBtn = $( "<a href='#' class='tablesaw-nav-btn btn btn-micro left' title='Previous Column'></a>" ).appendTo( $btns ),
      $nextBtn = $( "<a href='#' class='tablesaw-nav-btn btn btn-micro right' title='Next Column'></a>" ).appendTo( $btns ),
      $headerCells = $table.find( "thead th" ),
      $headerCellsNoPersist = $headerCells.not( '[data-tablesaw-priority="persist"]' ),
      headerWidths = [],
      $head = $( document.head || 'head' ),
      tableId = $table.attr( 'id' ),
      // TODO switch this to an nth-child feature test
      supportsNthChild = !isIE8();

    if( !$headerCells.length ) {
      throw new Error( "tablesaw swipe: no header cells found. Are you using <th> inside of <thead>?" );
    }

    // Calculate initial widths
    $table.css('width', 'auto');
    $headerCells.each(function() {
      headerWidths.push( $( this ).outerWidth() );
    });
    $table.css( 'width', '' );

    $btns.appendTo( $table.prev().filter( '.tablesaw-bar' ) );

    $table.addClass( "tablesaw-swipe" );

    if( !tableId ) {
      tableId = 'tableswipe-' + Math.round( Math.random() * 10000 );
      $table.attr( 'id', tableId );
    }

    function $getCells( headerCell ) {
      return $( headerCell.cells ).add( headerCell );
    }

    function showColumn( headerCell ) {
      $getCells( headerCell ).removeClass( 'tablesaw-cell-hidden' );
    }

    function hideColumn( headerCell ) {
      $getCells( headerCell ).addClass( 'tablesaw-cell-hidden' );
    }

    function persistColumn( headerCell ) {
      $getCells( headerCell ).addClass( 'tablesaw-cell-persist' );
    }

    function isPersistent( headerCell ) {
      return $( headerCell ).is( '[data-tablesaw-priority="persist"]' );
    }

    function unmaintainWidths() {
      $table.removeClass( classes.persistWidths );
      $( '#' + tableId + '-persist' ).remove();
    }

    function maintainWidths() {
      var prefix = '#' + tableId + '.tablesaw-swipe ',
        styles = [],
        tableWidth = $table.width(),
        hash = [],
        newHash;

      $headerCells.each(function( index ) {
        var width;
        if( isPersistent( this ) ) {
          width = $( this ).outerWidth();

          // Only save width on non-greedy columns (take up less than 75% of table width)
          if( width < tableWidth * 0.75 ) {
            hash.push( index + '-' + width );
            styles.push( prefix + ' .tablesaw-cell-persist:nth-child(' + ( index + 1 ) + ') { width: ' + width + 'px; }' );
          }
        }
      });
      newHash = hash.join( '_' );

      $table.addClass( classes.persistWidths );

      var $style = $( '#' + tableId + '-persist' );
      // If style element not yet added OR if the widths have changed
      if( !$style.length || $style.data( 'hash' ) !== newHash ) {
        // Remove existing
        $style.remove();

        if( styles.length ) {
          $( '<style>' + styles.join( "\n" ) + '</style>' )
            .attr( 'id', tableId + '-persist' )
            .data( 'hash', newHash )
            .appendTo( $head );
        }
      }
    }

    function getNext(){
      var next = [],
        checkFound;

      $headerCellsNoPersist.each(function( i ) {
        var $t = $( this ),
          isHidden = $t.css( "display" ) === "none" || $t.is( ".tablesaw-cell-hidden" );

        if( !isHidden && !checkFound ) {
          checkFound = true;
          next[ 0 ] = i;
        } else if( isHidden && checkFound ) {
          next[ 1 ] = i;

          return false;
        }
      });

      return next;
    }

    function getPrev(){
      var next = getNext();
      return [ next[ 1 ] - 1 , next[ 0 ] - 1 ];
    }

    function nextpair( fwd ){
      return fwd ? getNext() : getPrev();
    }

    function canAdvance( pair ){
      return pair[ 1 ] > -1 && pair[ 1 ] < $headerCellsNoPersist.length;
    }

    function matchesMedia() {
      var matchMedia = $table.attr( "data-tablesaw-swipe-media" );
      return !matchMedia || ( "matchMedia" in win ) && win.matchMedia( matchMedia ).matches;
    }

    function fakeBreakpoints() {
      if( !matchesMedia() ) {
        return;
      }

      var extraPaddingPixels = 20,
        containerWidth = $table.parent().width(),
        persist = [],
        sum = 0,
        sums = [],
        visibleNonPersistantCount = $headerCells.length;

      $headerCells.each(function( index ) {
        var $t = $( this ),
          isPersist = $t.is( '[data-tablesaw-priority="persist"]' );

        persist.push( isPersist );

        sum += headerWidths[ index ] + ( isPersist ? 0 : extraPaddingPixels );
        sums.push( sum );

        // is persistent or is hidden
        if( isPersist || sum > containerWidth ) {
          visibleNonPersistantCount--;
        }
      });

      var needsNonPersistentColumn = visibleNonPersistantCount === 0;

      $headerCells.each(function( index ) {
        if( persist[ index ] ) {

          // for visual box-shadow
          persistColumn( this );
          return;
        }

        if( sums[ index ] <= containerWidth || needsNonPersistentColumn ) {
          needsNonPersistentColumn = false;
          showColumn( this );
        } else {
          hideColumn( this );
        }
      });

      if( supportsNthChild ) {
        unmaintainWidths();
      }
      $table.trigger( 'tablesawcolumns' );
    }

    function advance( fwd ){
      var pair = nextpair( fwd );
      if( canAdvance( pair ) ){
        if( isNaN( pair[ 0 ] ) ){
          if( fwd ){
            pair[0] = 0;
          }
          else {
            pair[0] = $headerCellsNoPersist.length - 1;
          }
        }

        if( supportsNthChild ) {
          maintainWidths();
        }

        hideColumn( $headerCellsNoPersist.get( pair[ 0 ] ) );
        showColumn( $headerCellsNoPersist.get( pair[ 1 ] ) );

        $table.trigger( 'tablesawcolumns' );
      }
    }

    $prevBtn.add( $nextBtn ).click(function( e ){
      advance( !!$( e.target ).closest( $nextBtn ).length );
      e.preventDefault();
    });

    function getCoord( event, key ) {
      return ( event.touches || event.originalEvent.touches )[ 0 ][ key ];
    }

    $table
      .bind( "touchstart.swipetoggle", function( e ){
        var originX = getCoord( e, 'pageX' ),
          originY = getCoord( e, 'pageY' ),
          x,
          y;

        $( win ).off( "resize", fakeBreakpoints );

        $( this )
          .bind( "touchmove", function( e ){
            x = getCoord( e, 'pageX' );
            y = getCoord( e, 'pageY' );
            var cfg = Tablesaw.config.swipe;
            if( Math.abs( x - originX ) > cfg.horizontalThreshold && Math.abs( y - originY ) < cfg.verticalThreshold ) {
              e.preventDefault();
            }
          })
          .bind( "touchend.swipetoggle", function(){
            var cfg = Tablesaw.config.swipe;
            if( Math.abs( y - originY ) < cfg.verticalThreshold ) {
              if( x - originX < -1 * cfg.horizontalThreshold ){
                advance( true );
              }
              if( x - originX > cfg.horizontalThreshold ){
                advance( false );
              }
            }

            window.setTimeout(function() {
              $( win ).on( "resize", fakeBreakpoints );
            }, 300);
            $( this ).unbind( "touchmove touchend" );
          });

      })
      .bind( "tablesawcolumns.swipetoggle", function(){
        var canGoPrev = canAdvance( getPrev() );
        var canGoNext = canAdvance( getNext() );
        $prevBtn[ canGoPrev ? "removeClass" : "addClass" ]( classes.hideBtn );
        $nextBtn[ canGoNext ? "removeClass" : "addClass" ]( classes.hideBtn );

        $prevBtn.closest( "." + classes.toolbar )[ !canGoPrev && !canGoNext ? 'addClass' : 'removeClass' ]( classes.allColumnsVisible );
      })
      .bind( "tablesawnext.swipetoggle", function(){
        advance( true );
      } )
      .bind( "tablesawprev.swipetoggle", function(){
        advance( false );
      } )
      .bind( "tablesawdestroy.swipetoggle", function(){
        var $t = $( this );

        $t.removeClass( 'tablesaw-swipe' );
        $t.prev().filter( '.tablesaw-bar' ).find( '.tablesaw-advance' ).remove();
        $( win ).off( "resize", fakeBreakpoints );

        $t.unbind( ".swipetoggle" );
      });

    fakeBreakpoints();
    $( win ).on( "resize", fakeBreakpoints );
  }



  // on tablecreate, init
  $( document ).on( "tablesawcreate", function( e, Tablesaw ){

    if( Tablesaw.mode === 'swipe' ){
      createSwipeTable( Tablesaw.$table );
    }

  } );

}( this, jQuery ));