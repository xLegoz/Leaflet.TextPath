/*
 * Inspired by Tom Mac Wright article :
 * http://mapbox.com/osmdev/2012/11/20/getting-serious-about-svg/
 */

(function () {

var __onAdd = L.Polyline.prototype.onAdd,
    __onRemove = L.Polyline.prototype.onRemove,
    __updatePath = L.Polyline.prototype._updatePath,
    __bringToFront = L.Polyline.prototype.bringToFront;


var PolylineTextPath = {

    onAdd: function (map) {
        __onAdd.call(this, map);
        this.setStyle({
            stroke: false
        });
        this.alignment = 0;
        this._textRedraw();
    },

    onRemove: function (map) {
        map = map || this._map;
        if (map && this._textNode)
            map._pathRoot.removeChild(this._textNode);
        __onRemove.call(this, map);
    },

    bringToFront: function () {
        __bringToFront.call(this);
        this._textRedraw();
    },

    _updatePath: function () {
        __updatePath.call(this);
        // this._textRedraw();
    },

    _textRedraw: function () {
        var text = this._text,
            options = this._textOptions;
        if (text) {
            this.setText(null).setText(text, options);
        }
    },

    _getBounds: function(latlng, text, options) {
        /**
         * Stateless fcn
         */

        /* Compute single pattern length */
        var max = 0;
        if (Array.isArray(text)) {
            for (var i = 0; i < text.length; ++i) {
                var length = this._compute_length(text[i], options);
                if (max < length) {
                    max = length;
                }
            }
        }
        else {
            max = this._compute_length(text, options);
        }
        // max = max * 2;

        var point = map.latLngToLayerPoint(latlng);

        var left_point;
        var right_point;

        if (this.alignment === 0) {
            left_point = new L.Point(point.x - (max * 0.5), point.y);
            right_point = new L.Point(point.x + (max * 0.5), point.y);
        }
        else if (this.alignment === 90) {
            left_point = new L.Point(point.x, point.y + (max * 0.5));
            right_point = new L.Point(point.x, point.y - (max * 0.5));
        }
        else if (this.alignment === 180) {
            left_point = new L.Point(point.x + (max * 0.5), point.y);
            right_point = new L.Point(point.x - (max * 0.5), point.y);
        }
        else if (this.alignment === 270) {
            left_point = new L.Point(point.x, point.y - (max * 0.5));
            right_point = new L.Point(point.x, point.y + (max * 0.5));
        }

        var left_latlng = map.layerPointToLatLng(left_point);
        var right_latlng = map.layerPointToLatLng(right_point);

        return [left_latlng, right_latlng];
    },

    _compute_length: function(text, options) {
        var svg = this._map._pathRoot;
        var pattern = L.Path.prototype._createElement('text');
        for (var attr in options.attributes) {
            pattern.setAttribute(attr, options.attributes[attr]);
        }
        pattern.appendChild(document.createTextNode(text));
        svg.appendChild(pattern);
        var alength = pattern.getComputedTextLength();
        svg.removeChild(pattern);
        return alength;
    },

    rotate_right: function() {
        this.alignment += 90;
        if (this.alignment === 360) {
            this.alignment = 0;
        }

        var text = this._text.replace(/ /g, '\u00A0').split("\n");

        var center = this.getBounds().getCenter();
        this.setLatLngs(this._getBounds(center, text, this._textOptions));
    },

    setText: function (text, options) {
        var svg = this._map._pathRoot;
        this._text = text;
        /* If not in SVG mode or Polyline not added to map yet return */
        /* setText will be called by onAdd, using value stored in this._text */
        if (!L.Browser.svg || typeof this._map === 'undefined') {
          return this;
        }

        var dark_basemap = (globalData.basemap === "dark_map" || 
                            globalData.basemap === "googleLayerHybrid" ||
                            globalData.basemap === "googleLayerSatellite");

        var defaults = {
            repeat: false,
            attributes: {
                class: "leaflet-label-text"
            },
            center: true
        };

        var basemap_options = {
            attributes: {
                fill: (dark_basemap) ? 'white' : 'black'
            }
        };

        options = L.Util.extend(defaults, options);
        options = L.Util.extend(options, basemap_options);
        this._textOptions = options;


        /* If empty text, hide */
        if (!text) {
            if (this._textNode && this._textNode.parentNode) {
                this._map._pathRoot.removeChild(this._textNode);
                
                /* delete the node, so it will not be removed a 2nd time if the layer is later removed from the map */
                delete this._textNode;
            }
            return this;
        }

        text = text.replace(/ /g, '\u00A0');  // Non breakable spaces
        var id = 'pathdef-' + L.Util.stamp(this);
        var svg = this._map._pathRoot;
        this._path.setAttribute('id', id);

        text = text.split("\n");
        text.map(function(elem) {
            return (elem === "") ? " " : elem;
        });

        var center = this.getBounds().getCenter();
        this.setLatLngs(this._getBounds(center, text, options));

        /* Put it along the path using textPath */
        if (!this._textNode) {

            var textNode = L.Path.prototype._createElement('text'),
            textPath = L.Path.prototype._createElement('textPath');

            var dy = options.offset || this._path.getAttribute('stroke-width');

            textPath.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", '#'+id);
            textNode.setAttribute('dy', dy);
            for (var attr in options.attributes) {
                textNode.setAttribute(attr, options.attributes[attr]);
            }


            var previous_length = 0;
            for (var i = 0; i < text.length; ++i) {
                var tspan = L.Path.prototype._createElement('tspan');
                tspan.setAttribute('dy', (i === 0) ? 0 : 20);
                tspan.setAttribute('dx', -previous_length);
                tspan.appendChild(document.createTextNode(text[i]));

                if (i !== text.length -1) {
                    var alength = this._compute_length(text[i], options);
                    if (alength !== 0) {
                        previous_length =  alength;
                    }
                }

                textPath.appendChild(tspan);
            }
            textPath.classList.add("leaflet-label-text");
            textNode.appendChild(textPath);
            this._textNode = textNode;
            this._textPath = textPath;

            if (options.below) {
                svg.insertBefore(textNode, svg.firstChild);
            }
            else {
                svg.appendChild(textNode);
            }

            /* Center text according to the path's bounding box */
            if (options.center) {
                var textWidth = textNode.getBBox().width;
                var pathWidth = this._path.getBoundingClientRect().width;
                /* Set the position for the left side of the textNode */
                textNode.setAttribute('dx', ((pathWidth / 2) - (textWidth / 2)));
            }

            /* Initialize mouse events for the additional nodes */
            if (this.options.clickable) {
                if (L.Browser.svg || !L.Browser.vml) {
                    textPath.classList.add('leaflet-clickable');
                }

                L.DomEvent.on(textNode, 'click', this._onMouseClick, this);

                var events = ['dblclick', 'mousedown', 'mouseover',
                              'mouseout', 'mousemove', 'contextmenu'];
                for (var i = 0; i < events.length; i++) {
                    L.DomEvent.on(textNode, events[i], this._fireMouseEvent, this);
                }
            }
        }
        else {
            var children = this._textPath.children.length;
            var previous_length = 0;
            for (var i = 0; i < text.length; ++i) {
                if (i < children) {
                    this._textPath.children[i].textContent = text[i];
                    this._textPath.children[i].setAttribute('dx', -previous_length);
                }
                else {
                    var tspan = L.Path.prototype._createElement('tspan');
                    tspan.setAttribute('dy', (i === 0) ? 0 : 20);
                    tspan.setAttribute('dx', -previous_length);

                    tspan.appendChild(document.createTextNode(text[i]));
                    this._textPath.appendChild(tspan);   
                }

                if (i !== text.length -1) {
                    var alength = this._compute_length(text[i], options);
                    if (alength !== 0) {
                        previous_length =  alength;
                    }
                }

            }

            if (text.length < children) {
                for (var i = children - 1; i > text.length - 1; --i) {
                    this._textPath.children[i].remove();
                }
            }
        }

        return this;
    }
};

L.Polyline.include(PolylineTextPath);

L.LayerGroup.include({
    setText: function(text, options) {
        for (var layer in this._layers) {
            if (typeof this._layers[layer].setText === 'function') {
                this._layers[layer].setText(text, options);
            }
        }
        return this;
    }
});

})();
