/** @react-pdf + client PDF templates expect classic JSX runtime in Node (tsx). */
import React from 'react';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
