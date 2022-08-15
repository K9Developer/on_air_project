import React from 'react';
import { TouchableOpacity, Text, Image, Dimensions } from 'react-native';

import { COLORS, SIZES, FONTS, SHADOWS } from '../constants';
const winWidth = Dimensions.get('window').width;

export const CircleButton = ({
  imgUrl,
  handlePressDown,
  handlePressUp,
  size,
  ...props
}) => {
  return (
    <TouchableOpacity
      style={{
        width: 60,
        height: 60,
        backgroundColor: '#427ef5',
        borderRadius: 2 * (winWidth / 5),
        alignItems: 'center',
        justifyContent: 'center',
        ...props,
      }}
      onPressIn={handlePressDown}
      onPressOut={handlePressUp}>
      <Image
        key={new Date()}
        source={imgUrl}
        resizeMode="contain"
        style={{ width: size[0], height: size[1] }}
      />
    </TouchableOpacity>
  );
};

export const RectButton = ({
  width,
  fontSize,
  handlePressDown,
  handlePressUp,
  text,
  ...props
}) => {
  return (
    <TouchableOpacity
      style={{
        backgroundColor: COLORS.primary,
        borderRadius: 2 * (winWidth / 25),
        width: width,
        justifyContent: 'center',
        ...props,
      }}
      onPressIn={handlePressDown}
      onPressOut={handlePressUp}>
      <Text
        adjustsFontSizeToFit
        numberOfLines={1}
        style={{
          fontFamily: FONTS.regular,
          fontSize: fontSize,
          color: COLORS.white,
          textAlign: 'center',
        }}>
        {text}
      </Text>
    </TouchableOpacity>
  );
};

export const ImageRectButton = ({
  handlePressDown,
  handlePressUp,
  img,
  size,
  ...props
}) => {
  return (
    <TouchableOpacity
      style={{
        backgroundColor: 'red',
        borderRadius: 2 * (winWidth / 25),
        width: size[0],
        height: size[1],
        justifyContent: 'center',
        alignItems: 'center',
        ...props,
      }}
      onPressIn={handlePressDown}
      onPressOut={handlePressUp}>
      <Image
        source={img}
        resizeMode="center"
      // style={{width: size[0], height: size[1]}}
      />
    </TouchableOpacity>
  );
};
