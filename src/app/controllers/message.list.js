angular.module("proton.controllers.Messages.List", ["proton.constants"])

.controller("MessageListController", function(
    $q,
    $rootScope,
    $scope,
    $state,
    $stateParams,
    $timeout,
    $translate,
    $filter,
    CONSTANTS,
    Message,
    Label,
    authentication,
    messageCache,
    messageCounts,
    messages,
    networkActivityTracker,
    notify
) {
    var mailbox = $rootScope.pageName = $state.current.data.mailbox;

    $scope.messagesPerPage = $scope.user.NumMessagePerPage;
    $scope.labels = authentication.user.Labels;
    $scope.Math = window.Math;
    $scope.CONSTANTS = CONSTANTS;
    $scope.messages = messages;
    $scope.selectedFilter = $stateParams.filter;
    $scope.selectedOrder = $stateParams.sort || "-date";
    $scope.page = parseInt($stateParams.page || 1);
    $scope.params = {
        messageHovered: null
    };

    $timeout(function() {
        $('#page').val($scope.page);
        $('#page').change(function(event) {
            $scope.goToPage();
        });

        $scope.initHotkeys();
        $scope.refreshMessagesCache();
        $scope.$apply();
    });

    $scope.initHotkeys = function() {
        Mousetrap.bind(["s"], function() {
            if ($state.includes("secured.**") && $scope.params.messageHovered) {
                $scope.toggleStar($scope.params.messageHovered);
            }
        });
        Mousetrap.bind(["r"], function() {
            if ($state.includes("secured.**") && $scope.params.messageHovered) {
                $scope.params.messageHovered.Selected = true;
                $scope.setMessagesReadStatus(true);
            }
        });
        Mousetrap.bind(["u"], function() {
            if ($state.includes("secured.**") && $scope.params.messageHovered) {
                $scope.params.messageHovered.Selected = true;
                $scope.setMessagesReadStatus(false);
            }
        });
    };

    var unsubscribe = $rootScope.$on("$stateChangeSuccess", function() {
        $rootScope.pageName = $state.current.data.mailbox;
    });

    $scope.$on("$destroy", unsubscribe);

    $scope.draggableOptions = {
        appendTo: "html",
        delay: 100,
        cancel: ".starLink",
        cursorAt: {left: 0, top: 0},
        cursor: "move",
        helper: function(event) {
            return $('<span class="well well-sm draggable" id="draggableMailsHelper"><i class="fa fa-envelope-o"></i> <strong><b></b> Mails</strong></span>');
        },
        containment: "document"
    };

    messageCache.watchScope($scope, "messages");

    $timeout(function() {
        $scope.unselectAllMessages();
    });

    $scope.$on('refreshMessages', function(event, silently, empty) {
        $scope.refreshMessages(silently, empty);
    });

    if (typeof $rootScope.messageTotals === 'undefined') {
        Message.totalCount().$promise.then(function(totals) {
            var total = {Labels:{}, Locations:{}, Starred: totals.Starred};
            _.each(totals.Labels, function(obj) { total.Labels[obj.LabelID] = obj.Count; });
            _.each(totals.Locations, function(obj) { total.Locations[obj.Location] = obj.Count; });
            $rootScope.messageTotals = total;
        });
    }

    $scope.messageCount = function() {
        if(angular.isDefined($stateParams.filter)) {
            return $rootScope.Total;
        } else {
            if (mailbox === 'label') {
                if ($rootScope.messageTotals && $rootScope.messageTotals.Labels[$stateParams.label]) {
                    return $rootScope.messageTotals.Labels[$stateParams.label];
                } else {
                    return $rootScope.Total;
                }
            } else if(mailbox === 'starred'){
                if ($rootScope.messageTotals && $rootScope.messageTotals.Starred) {
                    return $rootScope.messageTotals.Starred;
                } else {
                    return $rootScope.Total;
                }
            } else {
                if ($rootScope.messageTotals && $rootScope.messageTotals.Locations[CONSTANTS.MAILBOX_IDENTIFIERS[mailbox]]) {
                    return $rootScope.messageTotals.Locations[CONSTANTS.MAILBOX_IDENTIFIERS[mailbox]];
                } else {
                    return $rootScope.Total;
                }
            }
        }
    };

    $scope.makeDropdownPages = function() {
        var ddp = [];
        var ddp2 = [];
        var makeRangeCounter = 0;

        for (var i = 0; i <= parseInt($scope.messageCount() - 1); i++) {
            ddp[i] = i;
        }

        function makeRange(element, index, array) {
            if(index%CONSTANTS.MESSAGES_PER_PAGE === 0) {
                ddp2.push((index+1) + ' - ' + (index+CONSTANTS.MESSAGES_PER_PAGE));
                makeRangeCounter++;
            }
        }

        ddp.forEach(makeRange);

        return ddp2;
    };

    $scope.getMessagesParameters = function(mailbox) {
        var params = {};

        params.Location = CONSTANTS.MAILBOX_IDENTIFIERS[mailbox];
        params.Page = ($stateParams.page || 1) - 1;

        if ($stateParams.filter) {
            params.Unread = +($stateParams.filter === 'unread');
        }

        if ($stateParams.sort) {
            var sort = $stateParams.sort;
            var desc = _.string.startsWith(sort, "-");

            if (desc) {
                sort = sort.slice(1);
            }

            params.Sort = _.string.capitalize(sort);
            params.Desc = +desc;
        }

        if (mailbox === 'search') {
            params.Location = $stateParams.location;
            params.Keyword = $stateParams.words;
            params.To = $stateParams.to;
            params.From = $stateParams.from;
            params.Subject = $stateParams.subject;
            params.Begin = $stateParams.begin;
            params.End = $stateParams.end;
            params.Attachments = $stateParams.attachments;
            params.Starred = $stateParams.starred;
            params.Label = $stateParams.label;
        } else if(mailbox === 'label') {
            delete params.Location;
            params.Label = $stateParams.label;
        }

        _.pick(params, _.identity);

        return params;
    };

    $scope.refreshMessages = function(silently, empty) {
        var mailbox = $state.current.name.replace('secured.', '');
        var params = $scope.getMessagesParameters(mailbox);

        Message.query(params).$promise.then(function(result) {
            $scope.messages = result;

            if(!!!empty) {
                $scope.emptying = false;
            }
        });
    };

    $scope.$on('refreshMessagesCache', function(){
        $scope.refreshMessagesCache();
    });

    $scope.refreshMessagesCache = function () {
        var mailbox = $state.current.name.replace('secured.', '');
        var params = $scope.getMessagesParameters(mailbox);

        messageCache.query(params).then(function(messages) {
            $scope.messages = messages;
            $scope.$apply();
        });
    };

    $scope.$on('updateLabels', function(){$scope.updateLabels();});

    $scope.updateLabels = function () {
        $scope.labels = authentication.user.Labels;
    };

    $scope.showTo = function(message) {
        return (
            $scope.senderIsMe(message) &&
            (
                !$state.is('secured.inbox') &&
                !$state.is('secured.drafts')  &&
                !$state.is('secured.sent')  &&
                !$state.is('secured.archive')  &&
                !$state.is('secured.spam')  &&
                !$state.is('secured.trash')
            )
        ) ? true : false;
    };

    $scope.showFrom = function(message) {
        return ((
                !$state.is('secured.inbox') &&
                !$state.is('secured.drafts')  &&
                !$state.is('secured.archive') &&
                !$state.is('secured.sent') &&
                !$state.is('secured.spam') &&
                !$state.is('secured.trash')
            )
        ) ? true : false;
    };

    $scope.senderIsMe = function(message) {
        var result = false;
        for( var i = 0, len = $scope.user.Addresses.length; i < len; i++ ) {
            if( $scope.user.Addresses[i].Email === message.SenderAddress ) {
                result = true;
            }
        }
        return result;
    };

    $scope.getLabel = function(id) {
        return _.where($scope.labels, {ID: id})[0];
    };

    $scope.getColorLabel = function(id) {
        return {
            backgroundColor: $scope.getLabel(id).Color
        };
    };

    $scope.onSelectMessage = function(event, message) {
        if (event.shiftKey) {
            var start = $scope.messages.indexOf(_.first($scope.selectedMessages()));
            var end = $scope.messages.indexOf(_.last($scope.selectedMessages()));

            for (var i = start; i < end; i++) {
                $scope.messages[i].Selected = true;
            }
        }
    };

    $scope.onStartDragging = function(event, ui, message) {
        setTimeout( function() {
            $('#draggableMailsHelper strong b').text($scope.selectedMessages().length);
        }, 20);
        $('body').addClass('dragging');
        $('#main').append('<div id="dragOverlay"></div>');
        if(message && !!!message.Selected) {
            message.Selected = true;
            $scope.$apply();
        }
    };

    $scope.onEndDragging = function(event, ui, message) {
        $('body').removeClass('dragging');
        $('#dragOverlay').fadeOut(200, function() {
            $(this).remove();
        });
    };

    $scope.setPage = function (pageNo) {
        $scope.currentPage = pageNo;
    };

    $scope.start = function() {
        return ($scope.page - 1) * $scope.messagesPerPage + 1;
    };

    $scope.end = function() {
        var end;

        end = $scope.start() + $scope.messagesPerPage - 1;

        if (end > $scope.messageCount()) {
            end = $scope.messageCount();
        }

        return end;
    };

    $scope.hasNextPage = function() {
        return $scope.messageCount() > ($scope.page * $scope.messagesPerPage);
    };

    $scope.navigateToMessage = function(event, message) {
        if (!event || !$(event.target).closest("td").hasClass("actions")) {
            if (message === 'last') {
                message = _.last(messages);
            } else if (message === 'first') {
                message = _.first(messages);
            }

            if(message.IsRead === 0) {
                messageCounts.updateUnread('mark', [message], true);
            }

            if ($state.is('secured.drafts')) {
                networkActivityTracker.track(
                Message.get({id: message.ID}).$promise.then(function(m) {
                    m.decryptBody(m.Body, m.Time).then(function(body) {
                        m.Body = body;

                        if(m.Attachments && m.Attachments.length > 0) {
                            m.attachmentsToggle = true;

                        }

                        $rootScope.$broadcast('loadMessage', m);
                    });
                }));
            } else {
                $state.go("secured." + mailbox + ".message", {
                    id: message.ID
                });
            }
        }
    };

    $scope.$on('starMessages', function(event) {
        var ids = $scope.selectedIds();
        var promise;

        _.each($scope.selectedMessages(), function(message) { message.Starred = 1; });
        promise = Message.star({IDs: ids}).$promise;
        networkActivityTracker.track(promise);
        $scope.unselectAllMessages();
    });

    $scope.toggleStar = function(message) {
        var inStarred = $state.is('secured.starred');
        var index = $scope.messages.indexOf(message);
        var ids = [];
        var promise;
        var counters = messageCounts.get();

        ids.push(message.ID);

        if(message.Starred === 1) {
            promise = Message.unstar({IDs: ids}).$promise;
            $rootScope.messageTotals.Starred--;
            message.Starred = 0;

            if (message.IsRead === 0) {
                counters.Starred--;
                messageCounts.update(counters);
            }
            if (inStarred) {
                $scope.messages.splice(index, 1);
            }
        } else {
            promise = Message.star({IDs: ids}).$promise;
            $rootScope.messageTotals.Starred++;
            message.Starred = 1;
            if (message.IsRead === 0) {
                counters.Starred++;
                messageCounts.update(counters);
            }
        }
    };

    $scope.allSelected = function() {
        var status = true;

        if ($scope.messages.length > 0) {
            _.forEach($scope.messages, function(message) {
                if (!!!message.Selected) {
                    status = false;
                }
            });
        } else {
            status = false;
        }

        return status;
    };

    $scope.selectAllMessages = function(val) {
        var status = !!!$scope.allSelected();

        _.forEach($scope.messages, function(message) {
            message.Selected = status;
        });
    };

    $scope.$on('goToFolder', function(event) {
        $scope.unselectAllMessages();
    });

    $scope.unselectAllMessages = function() {
        _.forEach($scope.messages, function(message) {
            message.Selected = false;
        });
    };

    $scope.selectedMessages = function() {
        return _.select($scope.messages, function(message) {
            return message.Selected === true;
        });
    };

    $scope.selectedIds = function() {
        return _.map($scope.selectedMessages(), function(message) { return message.ID; });
    };

    $scope.selectedMessagesWithReadStatus = function(bool) {
        return _.select($scope.selectedMessages(), function(message) {
            return message.IsRead === +bool;
        });
    };

    $scope.messagesCanBeMovedTo = function(otherMailbox) {
        if (otherMailbox === "inbox") {
            return _.contains(["spam", "trash"], mailbox);
        } else if (otherMailbox === "trash") {
            return _.contains(["inbox", "drafts", "spam", "sent", "starred"], mailbox);
        } else if (otherMailbox === "spam") {
            return _.contains(["inbox", "starred", "trash"], mailbox);
        } else if (otherMailbox === "drafts") {
            return _.contains(["trash"], mailbox);
        }
    };

    $scope.setMessagesReadStatus = function(status) {
        var messages = $scope.selectedMessagesWithReadStatus(!status);
        var ids = _.map(messages, function(message) { return message.ID; });
        var promise = (status) ? Message.read({IDs: ids}).$promise : Message.unread({IDs: ids}).$promise;

        _.each(messages, function(message) {
            message.IsRead = +status;
        });

        messageCounts.updateUnread('mark', messages, status);

        $scope.unselectAllMessages();
    };

    $scope.$on('discardDraft', function(event, id) {
        $scope.messages = _.filter($scope.messages, function(m) {
            return m.ID !== id;
        });
        $rootScope.$broadcast('refreshMessagesCache');
    });

    $scope.$on('moveMessagesTo', function(event, name) {
        $scope.moveMessagesTo(name);
    });

    $scope.moveMessagesTo = function(mailbox) {
        var ids = $scope.selectedIds();
        var inDelete = mailbox === 'delete';
        var promise = (inDelete) ? Message.delete({IDs: ids}).$promise : Message[mailbox]({IDs: ids}).$promise;
        var events = [];
        var movedMessages = [];

        _.forEach($scope.selectedMessages(), function (message) {
            var m = {LabelIDs: message.LabelIDs, OldLocation: message.Location, IsRead: message.IsRead, Location: CONSTANTS.MAILBOX_IDENTIFIERS[mailbox], Starred: message.Starred};
            var index = $scope.messages.indexOf(message);

            movedMessages.push(m);
            message.Location = CONSTANTS.MAILBOX_IDENTIFIERS[mailbox];
            events.push({Action: 3, ID: message.ID, Message: {message: message}});
            $scope.messages.splice(index, 1);
        });

		messageCache.set(events);
        messageCounts.updateUnread('move', movedMessages);
        messageCounts.updateTotals('move', movedMessages);

        promise.then(function(result) {
            if(inDelete) {
                if(ids.length > 1) {
                    notify($translate.instant('MESSAGES_DELETED'));
                } else {
                    notify($translate.instant('MESSAGE_DELETED'));
                }
            }
        });

        $scope.unselectAllMessages();
    };

    $scope.filterBy = function(status) {
        $state.go($state.current.name, _.extend({}, $state.params, {
            filter: status,
            page: undefined
        }));
    };

    $scope.clearFilter = function() {
        $state.go($state.current.name, _.extend({}, $state.params, {
            filter: undefined,
            page: undefined
        }));
    };

    $scope.orderBy = function(criterion) {
        $state.go($state.current.name, _.extend({}, $state.params, {
            sort: criterion === '-date' ? undefined : criterion,
            page: undefined
        }));
    };

    $scope.emptyFolder = function(location) {
        var c = confirm("Are you sure? This cannot be undone.");
        if (c !== true) {
            return;
        }
        $scope.emptying = true;
        if (parseInt(location)===CONSTANTS.MAILBOX_IDENTIFIERS.drafts) {
            promise = Message.emptyDraft().$promise;
        }
        else if (parseInt(location)===CONSTANTS.MAILBOX_IDENTIFIERS.spam) {
            promise = Message.emptySpam().$promise;
        }
        else if (parseInt(location)===CONSTANTS.MAILBOX_IDENTIFIERS.trash) {
            promise = Message.emptyTrash().$promise;
        }
        promise.then(
            function(result) {
                $rootScope.$broadcast('updateCounters');
                $rootScope.$broadcast('refreshMessages', true, true);
                notify($translate.instant('FOLDER_EMPTIED'));
            },
            function(result) {
                $scope.emptying = false;
            }
        );
    };

    $scope.unselectAllLabels = function() {
        _.forEach($scope.labels, function(label) {
            label.Selected = false;
        });
    };

    $scope.openLabels = function(message) {
        var messages = [];
        var messagesLabel = [];
        var labels = $scope.labels;

        if (angular.isDefined(message)) {
            messages.push(message);
        } else {
            messages = $scope.selectedMessages();
        }

        _.each(messages, function(message) {
            messagesLabel = messagesLabel.concat(_.map(message.LabelIDs, function(id) {
                return id;
            }));
        });

        _.each(labels, function(label) {
            var count = _.filter(messagesLabel, function(m) {
                return m === label.ID;
            }).length;

            label.Selected = count > 0;
        });

        $timeout(function() {
            $('#searchLabels').focus();
        });
    };

    $scope.closeLabels = function() {
        $scope.unselectAllLabels();
        $('[data-toggle="dropdown"]').parent().removeClass('open');
    };

    $scope.saveLabels = function(labels) {
        var deferred = $q.defer();
        var messageIDs = $scope.selectedIds();
        var toApply = _.map(_.where(labels, {Selected: true}), function(label) { return label.ID; });
        var toRemove = _.map(_.where(labels, {Selected: false}), function(label) { return label.ID; });
        var promises = [];

        messageCounts.updateUnreadLabels($scope.selectedMessages(), toApply, toRemove);
        messageCounts.updateTotalLabels($scope.selectedMessages(), toApply, toRemove);

        _.each(toApply, function(labelID) {
            promises.push(Label.apply({id: labelID, MessageIDs: messageIDs}).$promise);
        });

        _.each(toRemove, function(labelID) {
            promises.push(Label.remove({id: labelID, MessageIDs: messageIDs}).$promise);
        });

        $q.all(promises).then(function() {
            if($state.is('secured.label')) {
                $scope.messages = _.difference($scope.messages, $scope.selectedMessages());
            } else {
                _.each($scope.selectedMessages(), function(message) {
                    message.LabelIDs = _.difference(_.uniq(message.LabelIDs.concat(toApply)), toRemove);
                });
                $scope.unselectAllMessages();
            }

            deferred.resolve();
        });

        networkActivityTracker.track(deferred.promise);

        return deferred.promise;
    };

    $scope.$on('applyLabels', function(event, LabelID) {
        var messageIDs = _.map($scope.selectedMessages(), function(message) { return message.ID; });

        Label.apply({
            id: LabelID,
            MessageIDs: messageIDs
        }).then(function(result) {
            if (result.Error) {
                console.log(result.Error);
            }
        });
    });

    $scope.goToPage = function(page, scrollToBottom) {
        if(angular.isUndefined(page)) {
            page = parseInt($('#page').val());
        }

        $rootScope.scrollToBottom = scrollToBottom === true;
        $scope.page = page;

        if (page > 0 && $scope.messageCount() > ((page - 1) * $scope.messagesPerPage)) {
            if (page === 1) {
                page = undefined;
            }
            $state.go($state.current.name, _.extend({}, $state.params, {
                page: page
            }));
        }
    };

    $scope.hasAdjacentMessage = function(message, adjacency) {
        if (adjacency === +1) {
            if (messages.indexOf(message) === messages.length - 1) {
                return $scope.hasNextPage();
            } else {
                return true;
            }
        } else if (adjacency === -1) {
            if (messages.indexOf(message) === 0) {
                return $scope.page > 1;
            } else {
                return true;
            }
        }
    };

    $scope.goToAdjacentMessage = function(message, adjacency) {
        var idx = messages.indexOf(message);

        if (adjacency === +1 && idx === messages.length - 1) {
            $state.go("^.relative", {
                rel: 'first',
                page: $scope.page + adjacency
            });
        } else if (adjacency === -1 && messages.indexOf(message) === 0) {
            $state.go("^.relative", {
                rel: 'last',
                page: $scope.page + adjacency
            });
        } else if (Math.abs(adjacency) === 1) {
            $scope.navigateToMessage(null, messages[idx + adjacency]);
        }
    };
});
