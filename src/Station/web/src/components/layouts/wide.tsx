import React from 'react';
import Header from '../Header';
import Container from "./container";

/* Span full width of screen */
function WideLayout(props:any) {
  return (
      <div>
      <Header></Header>
      <Container>
          {props.children}
      </Container>
      </div>
  );
}

export default WideLayout;
