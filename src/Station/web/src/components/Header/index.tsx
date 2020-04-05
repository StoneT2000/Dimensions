import React, {useState} from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'antd';
import './index.scss';
// import { useHistory } from 'react-router-dom';

// import UserContext from '../../UserContext'
function Header() {
  // let history = useHistory();
  const [key, setKey] = useState();

  // const userHooks = useContext(UserContext);


  const handleClick = (e: any) => {
    setKey(e.key);
  };

  return (
    <Menu onClick={handleClick} selectedKeys={key} mode="horizontal" className="Header">
      <Menu.Item className="logo">
        {/* <Link to="/"><img src={logo} /></Link> */}
      </Menu.Item>
      <Menu.Item key="home">
        <Link to="/" rel="noopener noreferrer">
          Home
        </Link>
      </Menu.Item>
      <Menu.Item key="dimensions">
        <Link to="/dimensions" rel="noopener noreferrer">
          Dimensions
        </Link>
      </Menu.Item>
      <Menu.Item className="empty">
      </Menu.Item>
    </Menu>
  );
}

export default Header;
