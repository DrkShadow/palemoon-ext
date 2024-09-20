// ==UserScript==
// @name        Amazon
// @namespace   drkshadow.com
// @description Skip Amazon ads
// @include     https://*amazon.com/gp/buy/*
// @version     1
// @grant       none
// ==/UserScript==

{
  let skip = document.getElementById('prime-interstitial-nothanks-button');
  if (skip != null)
    skip.click();
}