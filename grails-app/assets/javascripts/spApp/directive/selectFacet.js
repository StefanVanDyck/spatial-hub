(function (angular) {
    'use strict';
    /**
     * @memberof spApp
     * @ngdoc directive
     * @name selectFacet
     * @description
     *   Facet selection controls
     */
    angular.module('select-facet-directive', ['map-service', 'predefined-areas-service'])
        .directive('selectFacet', ['$http', 'MapService', 'PredefinedAreasService', '$timeout', 'FacetAutoCompleteService', 'BiocacheService',
            'LayoutService', function ($http, MapService, PredefinedAreasService, $timeout, FacetAutoCompleteService, BiocacheService, LayoutService) {

                return {
                    templateUrl: '/spApp/selectFacetCtrl.htm',
                    scope: {
                        _selectedFacet: '=selectedFacet',
                        _uniqueId: '=uniqueId'
                    },
                    link: function (scope, element, attrs) {

                        scope.facet = {};
                        scope.facets = [];
                        scope.facetList = [];
                        scope.exportUrl = null;


                        FacetAutoCompleteService.search(BiocacheService.newQuery(["-*:*"])).then(function (data) {
                            scope.facets = data
                        });

                        scope.pageSize = 10;
                        scope.offset = 0;

                        scope.updatingPage = false;
                        scope.downloadSize = 0;

                        scope.facetFilter = '';

                        scope.indexFields = []
                        scope.activeFacets = []
                        scope.activeFacet = {}

                        LayoutService.addToSave(scope);

                        scope.ok = function (data) {
                            if (scope.step === 2) {
                                scope.applySelection();
                                scope.updateSel();

                            } else {
                                scope.step = scope.step + 1
                            }
                        };

                        scope.nextPage = function () {
                            scope.applySelection();
                            if (scope.offset + scope.pageSize < scope.activeFacet.max) {
                                scope.offset += scope.pageSize;
                                scope.updatePage()
                            }
                        };

                        scope.previousPage = function () {
                            scope.applySelection();
                            if (scope.offset > 0) {
                                scope.offset -= scope.pageSize;
                                scope.updatePage()
                            }
                        };

                        BiocacheService.getIndexFields().then(function (indexFields) {
                            scope.indexFields = indexFields
                        })

                        scope.updateActiveFacets = function (data) {
                            for (var j = 0; j < data.length; j++) {
                                var idx = -1
                                $.each(scope.activeFacets, function (i, v) {
                                    if (v.facet == data[j].name) {
                                        idx = i
                                    }
                                })
                                if (data[j].selected) {
                                    if (idx < 0) {
                                        var item = {
                                            name: data[j].description || data[j].downloadName || data[j].name,
                                            facet: data[j].name
                                        }
                                        scope.activeFacets.push(item)
                                        scope.activeFacet = item
                                        scope.facet = item.facet
                                    }
                                } else {
                                    if (idx >= 0) {
                                        scope.activeFacets.splice(idx, 0)
                                    }
                                }
                            }
                        }

                        scope.searchFacets = function () {
                            LayoutService.openModal('facet', {
                                data: scope.indexFields,
                                onChange: scope.updateActiveFacets
                            }, true)
                        }

                        scope.changeFacet = function () {
                            scope.updateSel()

                            if (scope.facet === 'search') {
                                scope.searchFacets()
                                scope.facet = ''
                                return;
                            }

                            var alreadyActive = false
                            $.each(scope.activeFacets, function (i, v) {
                                if (scope.facet === v.facet) {
                                    alreadyActive = true
                                    scope.activeFacet = v
                                }
                            })

                            if (!alreadyActive) {
                                $.each(scope.facets, function (i, v) {
                                    if (scope.facet === v.facet) {
                                        scope.activeFacets.push(v)
                                        scope.activeFacet = v
                                    }
                                })
                            }

                            if (!scope.activeFacet.selection) {
                                scope.activeFacet.selection = []
                            }

                            scope.offset = 0;
                            scope.updateFacet()
                        };

                        scope.clearFilter = function () {
                            scope.activeFacet.facetFilter='';
                            scope.facetFilter = '';
                            scope.offset = 0;
                            if (scope.activeFacet.selection) {
                                scope.activeFacet.selection = []
                            }
                            scope.updatePage()
                        };

                        scope.applyFilter = function () {
                            scope.facetFilter = scope.activeFacet.facetFilter;
                            scope.offset = 0;
                            scope.updatePage()
                        };


                        scope.updateFacet = function () {
                            scope.update(true);
                        };

                        scope.updatePage = function () {
                            scope.update(false);
                        };

                        scope.update = function (updateAll) {
                            scope.updatingPage = true;

                            var config = {
                                eventHandlers: {
                                    progress: function (c) {
                                        scope.downloadSize = c.loaded
                                    }
                                }
                            };

                            scope.applySelection();

                            var q = ["*:*"];
                            if ($SH.qc !== undefined && $SH.qc != null && $SH.qc.length > 0) q = [$SH.qc];
                            var pageSize = 10;
                            var offset = scope.offset;

                            $.each(scope.activeFacets, function (i, v) {
                                if (v.facet !== scope.facet) {
                                    // add this fq
                                    var fq = v.sel
                                    if (fq) {
                                        q.push(fq)
                                    }
                                } else {
                                    scope.activeFacet = v
                                }
                            })

                            if (scope.facet !== 'search' && scope.facet !== '') {
                                BiocacheService.facetGeneral(scope.facet, {
                                    q: q,
                                    bs: $SH.biocacheServiceUrl
                                }, pageSize, offset, scope.facetFilter, config).then(function (data) {
                                    if (data.length > 0) {
                                        scope.activeFacet.facetList = data[0].fieldResult;
                                        scope.activeFacet.exportUrl = BiocacheService.facetDownload(scope.facet);
                                        scope.activeFacet.max = data[0].count + scope.offset;
                                        scope.activeFacet.maxPages = Math.ceil(scope.activeFacet.max / scope.pageSize)
                                    } else {
                                        scope.activeFacet.max = 0;
                                        scope.activeFacet.facetList = [];
                                        scope.activeFacet.maxPages = 0
                                    }
                                    scope.updateSel();
                                    scope.updateCheckmarks();

                                    scope.updatingPage = false;
                                })
                            }
                        };

                        scope.clearSelection = function () {
                            for (var i = 0; i < scope.activeFacet.facetList.length; i++) {
                                scope.activeFacet.facetList[i].selected = false
                            }
                            scope.activeFacet.selection = [];
                            scope.updateSel()
                        };

                        scope.applySelection = function () {
                            if (scope.activeFacet.facetList) {
                                for (var i = 0; i < scope.activeFacet.facetList.length; i++) {
                                    if (scope.activeFacet.facetList[i].selected) {
                                        var found = false;
                                        for (var k in scope.activeFacet.selection) {
                                            if (scope.activeFacet.selection[k].fq === scope.activeFacet.facetList[i].fq) {
                                                found = true
                                            }
                                        }
                                        if (!found) scope.activeFacet.selection.push(scope.activeFacet.facetList[i])
                                    } else {
                                        for (k in scope.activeFacet.selection) {
                                            if (scope.activeFacet.selection[k].fq === scope.activeFacet.facetList[i].fq) {
                                                scope.activeFacet.selection.splice(Number(k), 1)
                                            }
                                        }
                                    }
                                }

                                scope.updateSel()
                            }
                        };

                        scope.updateCheckmarks = function () {
                            for (var i = 0; i < scope.activeFacet.facetList.length; i++) {
                                var found = false;
                                for (var k in scope.activeFacet.selection) {
                                    if (scope.activeFacet.selection[k].fq === scope.activeFacet.facetList[i].fq) {
                                        found = true
                                    }
                                }
                                if (found) scope.activeFacet.facetList[i].selected = true
                            }
                        };

                        scope.updateSel = function () {
                            if (scope.activeFacet.selection) {
                                var sel = '';
                                var invert = false;
                                var count = 0;
                                for (var i = 0; i < scope.activeFacet.selection.length; i++) {
                                    var fq = scope.activeFacet.selection[i].fq;
                                    if (fq.match(/^-/g) != null && (fq.match(/:\*$/g) != null || fq.match(/\[\* TO \*\]$/g) != null)) {
                                        invert = true
                                    }
                                    count++
                                }
                                if (count === 1) invert = false;
                                for (i = 0; i < scope.activeFacet.selection.length; i++) {
                                    fq = scope.activeFacet.selection[i].fq;

                                    if (invert) {
                                        if (sel.length > 0) sel += " AND ";
                                        if (fq.match(/^-/g) != null && (fq.match(/:\*$/g) != null || fq.match(/\[\* TO \*\]$/g) != null)) {
                                            sel += fq.substring(1)
                                        } else {
                                            sel += '-' + fq
                                        }
                                    } else {
                                        if (sel.length > 0) sel += " OR ";
                                        sel += fq
                                    }
                                }
                                if (invert) {
                                    sel = '-(' + sel + ')'
                                }

                                if (sel.length === 0) {
                                    scope.activeFacet.sel = ''
                                } else {
                                    scope.activeFacet.sel = sel
                                }

                                scope._selectedFacet.splice(0, scope._selectedFacet.length)

                                $.each(scope.activeFacets, function (i, v) {
                                    if (v.sel) {
                                        scope._selectedFacet.push(v.sel)
                                    }
                                })
                            }
                        }

                        // default selection
                        if (scope.activeFacets.length > 0) {
                            scope.facet = scope.activeFacets[scope.activeFacets.length - 1].facet
                            scope.changeFacet()
                        }
                    }
                }

            }])
}(angular));