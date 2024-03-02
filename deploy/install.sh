#!/bin/sh

[ ! -e /etc/systemd/system/webtimer.service ] && ln -s /opt/webtimer/deploy/webtimer.service /etc/systemd/system/webtimer.service
systemctl enable --now webtimer.service
